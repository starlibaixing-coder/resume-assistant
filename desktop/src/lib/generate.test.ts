// LLM 生题管线 —— prompt 内嵌 QUALITY 规则 / 解析容错 / 预检自修正重试(chat 全 mock,零网络)
import { describe, it, expect, vi } from 'vitest';
import {
  buildSystemPrompt,
  buildUserPrompt,
  buildJdSystemPrompt,
  buildJdUserPrompt,
  parseQuestions,
  validateGenerated,
  generateQuestions,
  generateJdQuestions,
  MAX_RETRIES,
  type GeneratedQuestion,
} from './generate';
import type { ChatOptions } from './provider';
import type { JdContext } from './generate';

const CHAT_OPTS: ChatOptions = { apiKey: 'k', baseURL: 'https://x', model: 'm' };

const JD: JdContext = {
  company: '示例公司',
  content: '负责 RAG 检索系统的设计与优化,熟悉向量数据库与 embedding 模型调优。',
  resume: '# 后端工程师\n- 5 年经验,做过搜索与推荐系统',
};

function good(): GeneratedQuestion[] {
  return [
    {
      difficulty: '中',
      title: 'useEffect 的清理函数在哪些时机执行?',
      focus: '理解 effect 生命周期与清理时机',
      answer: [
        '组件卸载时执行一次清理',
        '下一次 effect 重新执行前,会先执行上一次的清理函数,这是为了防止过期闭包和重复副作用',
        '严格模式下开发环境会额外跑一次挂载加清理,用于暴露不幂等的副作用',
      ],
      followups: ['为什么严格模式要故意执行两次?'],
      tags: ['react', 'hooks'],
    },
    {
      difficulty: '高',
      title: '手写一个深比较函数',
      focus: '递归与边界处理',
      answer: ['递归比较两值的类型与引用,对象逐键递归,数组逐项递归', '处理 NaN、Date、RegExp、循环引用等边界', '复杂度受深度与键数影响,循环引用需用 WeakSet 记录已访问路径'],
      followups: [],
      tags: ['js'],
    },
  ];
}

// ===== prompt =====

describe('buildSystemPrompt', () => {
  it('内嵌 QUALITY 四条设计红线 + focus 规则 + 硬规则', () => {
    const s = buildSystemPrompt({ topic: 'React' });
    expect(s).toContain('答案不得泄漏进题干');
    expect(s).toContain('追问不得隐含答案');
    expect(s).toContain('一题只考一条主线');
    expect(s).toContain('概念层次不得混乱');
    expect(s).toContain('focus 写"考察什么"');
    expect(s).toContain('不少于 50 字');
    expect(s).toContain('JSON 数组');
    expect(s).toContain('数量由你根据知识点广度判断');
    expect(s).toContain('宁缺毋滥');
    expect(s).toContain('不超过 12 道');
  });

  it('指定难度时锁死难度分布', () => {
    const s = buildSystemPrompt({ topic: 'React', difficulty: '高' });
    expect(s).toContain('必须是 "高"');
    expect(s).not.toContain('难度分布合理');
  });

  it('默认中文,language=en 切英文', () => {
    expect(buildSystemPrompt({ topic: 'x' })).toContain('中文');
    expect(buildSystemPrompt({ topic: 'x', language: 'en' })).toContain('English');
  });
});

describe('buildUserPrompt', () => {
  it('含知识点,不含固定数量(数量由 LLM 判断)', () => {
    const u = buildUserPrompt({ topic: 'React Hooks 深入' });
    expect(u).toContain('React Hooks 深入');
    expect(u).toContain('数量判断');
    expect(u).not.toMatch(/出 \d+ 道/);
  });
});

// ===== 解析 =====

describe('parseQuestions', () => {
  it('纯 JSON 数组直接解析', () => {
    const qs = parseQuestions(JSON.stringify(good()));
    expect(qs).toHaveLength(2);
    expect(qs[0].title).toContain('useEffect');
  });

  it('剥 markdown 围栏', () => {
    const qs = parseQuestions('```json\n' + JSON.stringify(good()) + '\n```');
    expect(qs).toHaveLength(2);
  });

  it('前后带废话时截取方括号', () => {
    const qs = parseQuestions('好的,以下是题目:\n' + JSON.stringify(good()) + '\n希望对你有帮助');
    expect(qs).toHaveLength(2);
  });

  it('无数组抛错', () => {
    expect(() => parseQuestions('{"a":1}')).toThrow('未找到 JSON 数组');
  });

  it('JSON 坏了抛错', () => {
    expect(() => parseQuestions('[{bad json}]')).toThrow('JSON 解析失败');
  });

  it('空数组抛错', () => {
    expect(() => parseQuestions('[]')).toThrow('非空');
  });
});

// ===== 预检 =====

describe('validateGenerated', () => {
  it('合法题通过(空错误)', () => {
    expect(validateGenerated(good())).toEqual([]);
  });

  it('answer 过短被拦(共享 validateQuestion)', () => {
    const qs = good();
    qs[0].answer = ['太短'];
    expect(validateGenerated(qs)[0]).toContain('答案过短');
  });

  it('difficulty 非法被拦', () => {
    const qs = good();
    qs[0].difficulty = 'expert';
    expect(validateGenerated(qs).some((e) => e.includes('difficulty'))).toBe(true);
  });

  it('tags 非数组被拦(运行时补充检查)', () => {
    const qs = good();
    (qs[0] as unknown as { tags: string }).tags = 'react';
    expect(validateGenerated(qs).some((e) => e.includes('tags'))).toBe(true);
  });
});

// ===== 主流程:自修正重试 =====

describe('generateQuestions', () => {
  it('一次通过:不重试,retries=0', async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify(good()));
    const r = await generateQuestions({ topic: 'React' }, CHAT_OPTS, chat);
    expect(r.retries).toBe(0);
    expect(r.questions).toHaveLength(2);
    expect(chat).toHaveBeenCalledTimes(1);
    // system prompt 确实传给了 chat
    const [messages] = chat.mock.calls[0];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('答案不得泄漏进题干');
  });

  it('首答含废题,自修正一次后通过', async () => {
    const bad = good();
    bad[1].answer = ['短']; // 校验不过
    const chat = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(bad))
      .mockResolvedValueOnce(JSON.stringify(good()));
    const r = await generateQuestions({ topic: 'React' }, CHAT_OPTS, chat);
    expect(r.retries).toBe(1);
    expect(r.questions).toHaveLength(2);
    expect(chat).toHaveBeenCalledTimes(2);
    // 第二次调用的最后一条 user 消息带错误清单
    const [messages2] = chat.mock.calls[1];
    const last = messages2[messages2.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('答案过短');
  });

  it('围栏包裹也能过(解析容错生效)', async () => {
    const chat = vi.fn().mockResolvedValue('```json\n' + JSON.stringify(good()) + '\n```');
    const r = await generateQuestions({ topic: 'React' }, CHAT_OPTS, chat);
    expect(r.retries).toBe(0);
  });

  it('重试耗尽抛错并汇总错误', async () => {
    const chat = vi.fn().mockResolvedValue('not json at all');
    await expect(generateQuestions({ topic: 'React' }, CHAT_OPTS, chat)).rejects.toThrow(
      `${MAX_RETRIES + 1} 次仍未通过校验`,
    );
    expect(chat).toHaveBeenCalledTimes(MAX_RETRIES + 1);
  });

  it('空知识点直接抛错,不调 LLM', async () => {
    const chat = vi.fn();
    await expect(generateQuestions({ topic: '  ' }, CHAT_OPTS, chat)).rejects.toThrow('知识点不能为空');
    expect(chat).not.toHaveBeenCalled();
  });
});

// ===== JD 定向生题(阶段 2 功能④) =====

describe('buildJdSystemPrompt', () => {
  it('内嵌 QUALITY 红线 + JD 定向规则 + 数量判断', () => {
    const s = buildJdSystemPrompt({ includeResume: true });
    expect(s).toContain('答案不得泄漏进题干');
    expect(s).toContain('宁缺毋滥');
    expect(s).toContain('不超过 12 道');
    expect(s).toContain('职位描述(JD)');
    expect(s).toContain('真实考点');
    expect(s).toContain('结合简历声称的经历出深挖题');
  });

  it('includeResume=false 时不提简历深挖规则', () => {
    const s = buildJdSystemPrompt({ includeResume: false });
    expect(s).not.toContain('结合简历声称的经历出深挖题');
  });

  it('指定难度锁死难度', () => {
    const s = buildJdSystemPrompt({ includeResume: false, difficulty: '高' });
    expect(s).toContain('必须是 "高"');
  });
});

describe('buildJdUserPrompt', () => {
  it('含公司 / JD / 简历,无公司回退(未填写)', () => {
    const u = buildJdUserPrompt(JD);
    expect(u).toContain('示例公司');
    expect(u).toContain('RAG 检索系统');
    expect(u).toContain('5 年经验');
    expect(u).toContain('JSON 数组');
  });

  it('公司为空显示(未填写)', () => {
    const u = buildJdUserPrompt({ ...JD, company: '' });
    expect(u).toContain('(未填写)');
  });

  it('简历为空不出现简历段落', () => {
    const u = buildJdUserPrompt({ ...JD, resume: '' });
    expect(u).not.toContain('候选人简历:');
  });
});

describe('generateJdQuestions', () => {
  it('复用管线:一次通过,system 含红线,user 含 JD', async () => {
    const chat = vi.fn().mockResolvedValue(JSON.stringify(good()));
    const r = await generateJdQuestions(JD, { includeResume: true }, CHAT_OPTS, chat);
    expect(r.retries).toBe(0);
    const [messages] = chat.mock.calls[0];
    expect(messages[0].content).toContain('答案不得泄漏进题干');
    expect(messages[1].content).toContain('RAG 检索系统');
  });

  it('JD 内容为空直接抛错,不调 LLM', async () => {
    const chat = vi.fn();
    await expect(
      generateJdQuestions({ company: 'c', content: '  ' }, { includeResume: false }, CHAT_OPTS, chat),
    ).rejects.toThrow('JD 内容为空');
    expect(chat).not.toHaveBeenCalled();
  });

  it('自修正循环同样生效', async () => {
    const bad = good();
    bad[0].answer = ['短'];
    const chat = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(bad))
      .mockResolvedValueOnce(JSON.stringify(good()));
    const r = await generateJdQuestions(JD, { includeResume: false }, CHAT_OPTS, chat);
    expect(r.retries).toBe(1);
    expect(chat).toHaveBeenCalledTimes(2);
  });
});
