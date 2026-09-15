// 出题管线:JSON 解析(剥围栏)/ 预检校验 / 自修正重试桩(≤2,仍失败整批丢弃)

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateQuestions, migrateLegacyApiKey, migrateLegacyLlmConfig, migrateLegacyProviderConfig, parseQuestionArray, resolveConfig, validateGenerated } from './generate';
import * as llm from './llm';
import { _resetStorageForTest, getMeta, getMyQuestions, getSecret, setMeta, setSecret } from './storage';

const GOOD = JSON.stringify([
  {
    module: 'Event Loop',
    difficulty: '中',
    title: '浏览器的事件循环是怎样的?',
    focus: '是否理解宏微任务调度',
    answer: ['主线程执行同步代码,遇到异步任务交给对应线程;'.repeat(3), '同步栈清空后先清微任务队列,再取一个宏任务;'.repeat(3)],
    followups: ['requestAnimationFrame 在哪个阶段执行?'],
  },
]);

beforeEach(() => {
  _resetStorageForTest();
  vi.restoreAllMocks();
});

describe('parseQuestionArray', () => {
  it('剥代码围栏后解析', () => {
    const parsed = parseQuestionArray('```json\n' + GOOD + '\n```');
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toContain('事件循环');
  });

  it('容忍前后杂讯,截取 [ ... ]', () => {
    const parsed = parseQuestionArray(`好的,以下是题目:\n${GOOD}\n希望有帮助`);
    expect(parsed).toHaveLength(1);
  });

  it('找不到数组时抛错', () => {
    expect(() => parseQuestionArray('没有数组')).toThrow(/JSON 数组/);
  });
});

describe('validateGenerated 预检', () => {
  it('答案 <50 字 / difficulty 非法 / 空题干各报一条', () => {
    const errs = validateGenerated({
      module: 'm',
      difficulty: '简单' as never,
      title: '',
      focus: '',
      answer: ['太短'],
      followups: [],
    });
    expect(errs).toContain('题干为空');
    expect(errs).toContain('focus 为空');
    expect(errs.some((e) => e.includes('答案过短'))).toBe(true);
    expect(errs.some((e) => e.includes('difficulty 不合法'))).toBe(true);
  });
});

describe('generateQuestions 自修正(桩)', () => {
  const cfg = { apiKey: 'k', baseUrl: 'https://x/v4', model: 'm', ready: true };

  it('首轮坏输出 → 错误回传,第二轮通过;产物落 pending', async () => {
    const spy = vi
      .spyOn(llm, 'chat')
      .mockResolvedValueOnce('这不是 JSON')
      .mockResolvedValueOnce(GOOD);
    const { saved, attempts } = await generateQuestions({ kind: 'ai', prompt: '闭包' }, cfg);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(attempts).toBe(2);
    expect(saved).toHaveLength(1);
    const rows = getMyQuestions();
    expect(rows[0].status).toBe('pending');
    expect(rows[0].id).toMatch(/^gen\./);
    expect(rows[0].sourceRef).toContain('闭包');
  });

  it('三轮仍失败 → 整批丢弃抛错,不产生 pending', async () => {
    vi.spyOn(llm, 'chat').mockResolvedValue('垃圾输出');
    await expect(generateQuestions({ kind: 'ai', prompt: '闭包' }, cfg)).rejects.toThrow(/已自动重试仍失败/);
    expect(getMyQuestions()).toHaveLength(0);
  });

  it('未配置直接拒绝', async () => {
    await expect(generateQuestions({ kind: 'ai', prompt: 'x' }, { ...cfg, ready: false })).rejects.toThrow(/未配置/);
  });
});

describe('migrateLegacyLlmConfig(旧版 localStorage 配置迁移)', () => {
  const fakeLs = (raw: string | null) => ({ getItem: (_k: string) => raw }) as Pick<Storage, 'getItem'>;

  it('meta 为空且存在旧配置 → 写入 meta 并返回 true', () => {
    const written: Record<string, string> = {};
    const ok = migrateLegacyLlmConfig(
      (k) => written[k] ?? '',
      (k, v) => { written[k] = v; },
      fakeLs(JSON.stringify({ baseURL: 'https://api.deepseek.com', model: 'deepseek-chat' })),
    );
    expect(ok).toBe(true);
    expect(written.ll_base_url).toBe('https://api.deepseek.com');
    expect(written.ll_model).toBe('deepseek-chat');
  });

  it('meta 已有值或无旧配置 → 不动', () => {
    const writes: [string, string][] = [];
    const write = (k: string, v: string) => writes.push([k, v]);
    expect(migrateLegacyLlmConfig(() => 'x', write, fakeLs('{"baseURL":"https://a"}'))).toBe(false);
    expect(migrateLegacyLlmConfig(() => '', write, fakeLs(null))).toBe(false);
    expect(writes).toHaveLength(0);
  });
});

describe('resolveConfig(按服务商)', () => {
  it('需要 Key 的服务商:有 Key 才 ready', () => {
    expect(resolveConfig('deepseek', 'https://api.deepseek.com', 'deepseek-chat', '').ready).toBe(false);
    expect(resolveConfig('deepseek', 'https://api.deepseek.com', 'deepseek-chat', 'sk-x').ready).toBe(true);
  });

  it('Ollama 本地:Key 留空也 ready', () => {
    const cfg = resolveConfig('ollama', 'http://localhost:11434/v1', 'qwen2.5:7b', '');
    expect(cfg.ready).toBe(true);
    expect(cfg.apiKey).toBe('');
  });
});

describe('migrateLegacyProviderConfig(全局 url/model → 按服务商分存)', () => {
  beforeEach(() => _resetStorageForTest());

  it('迁移到激活服务商名下;目标已存在时不覆盖', () => {
    setMeta('ll_provider', 'deepseek');
    setMeta('ll_base_url', 'https://api.deepseek.com');
    setMeta('ll_model', 'deepseek-v4-flash');
    expect(migrateLegacyProviderConfig(getMeta, setMeta)).toBe(true);
    expect(getMeta('ll_base_url:deepseek')).toBe('https://api.deepseek.com');
    expect(getMeta('ll_model:deepseek')).toBe('deepseek-v4-flash');

    // 目标已有:不迁移(保留该家自己的值)
    setMeta('ll_base_url', 'https://other.example.com');
    expect(migrateLegacyProviderConfig(getMeta, setMeta)).toBe(false);
    expect(getMeta('ll_base_url:deepseek')).toBe('https://api.deepseek.com');
  });

  it('无全局值时不动作', () => {
    setMeta('ll_provider', 'zhipu');
    expect(migrateLegacyProviderConfig(getMeta, setMeta)).toBe(false);
    expect(getMeta('ll_base_url:zhipu')).toBe('');
  });
});

describe('migrateLegacyApiKey(全局 Key → 按服务商分存)', () => {
  it('迁移到激活服务商名下并清除旧条目;已有目标 Key 时不覆盖', async () => {
    await setSecret('llm-api-key', 'sk-legacy');
    await migrateLegacyApiKey(getSecret, setSecret, () => 'deepseek');
    expect(getSecret('llm-api-key:deepseek')).toBe('sk-legacy');
    expect(getSecret('llm-api-key')).toBe('');

    // 再迁移一次:目标已有 Key,不得覆盖;旧条目已空,不再动作
    await setSecret('llm-api-key', 'sk-again');
    await migrateLegacyApiKey(getSecret, setSecret, () => 'deepseek');
    expect(getSecret('llm-api-key:deepseek')).toBe('sk-legacy');
    expect(getSecret('llm-api-key')).toBe('');
  });

  it('无旧条目时不动任何数据', async () => {
    await migrateLegacyApiKey(getSecret, setSecret, () => 'zhipu');
    expect(getSecret('llm-api-key:zhipu')).toBe('');
  });
});
