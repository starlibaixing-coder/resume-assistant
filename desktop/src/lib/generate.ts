// LLM 生题管线(阶段 1 功能①)。设计稿 §7 硬约束 1/2:
//   prompt 内嵌 QUALITY.md 设计规则 → 输出 JSON → 预检共享 validateQuestion
//   → 不达标把错误喂回 LLM 自修正重试(≤ MAX_RETRIES)→ 只返回不落库(由 UI 以 pending 入草稿区)
//
// 走 provider.chat(OpenAI 兼容,ADR-8),chat 函数注入(DI)便于零网络单测。
// agent.ts(Vercel AI SDK 工具循环)留给阶段 2+ 需要多步编排的场景。

import { chat as defaultChat, type ChatMessage, type ChatOptions } from './provider';
import { validateQuestion, type RawQuestion } from './validate';
import type { Difficulty } from '@/types/question';

export const MAX_RETRIES = 2;

export interface GenerateOptions {
  topic: string; // 知识点,如 "React Hooks 深入"
  difficulty?: Difficulty; // 不限 = undefined(用户目标水平,保留)
  language?: 'zh' | 'en'; // 默认中文
}

// LLM 输出的题目(无 id/index,入库时由 mylib.addDrafts 分配)
export interface GeneratedQuestion {
  difficulty: string;
  title: string;
  focus: string;
  answer: string[];
  followups: string[];
  tags: string[];
}

// ===== prompt =====

export function buildSystemPrompt(opts: GenerateOptions): string {
  const lang = opts.language === 'en' ? 'English' : '中文';
  return `你是一名资深技术面试官,负责为求职者出高质量面试题。请围绕给定知识点出面试题,使用${lang}。

出题数量由你根据知识点广度判断:
- 单一概念/窄知识点:2~4 道
- 复合知识域/宽知识点:5~10 道
- 无论如何不超过 12 道
每道题必须有独立、不可替代的考察点,宁缺毋滥,不要为凑数而出题。

输出格式(硬性要求):
- 只输出一个 JSON 数组,不要 markdown 代码围栏,不要任何其他文字或解释。
- 每个元素是一个对象,字段如下:
  - "difficulty": 只能是 "初"、"中"、"高" 之一
  - "title": 题干(一个问句或指令,自包含,不加编号前缀)
  - "focus": 考察点(一句话说明这道题考察什么能力/方向,不超过 40 字)
  - "answer": 答案数组(字符串数组,每条一个要点,所有条目合计不少于 50 字,技术准确、有深度)
  - "followups": 追问数组(字符串数组,可为空数组)
  - "tags": 标签数组(字符串数组,1~4 个)
${opts.difficulty ? `- 全部题目的 difficulty 必须是 "${opts.difficulty}"\n` : '- 难度分布合理:初/中/高搭配,以中为主\n'}
题目设计红线(违反任何一条都会被拒):
1. 答案不得泄漏进题干:题干后半句不得回答前半句,题干本身不得包含答题人该自己想到的要点。
2. 追问不得隐含答案:不点名题干该考的区分点,括号里不得给提示或答案。
3. 一题只考一条主线:多个子问题必须有递进关系(是什么→怎么做→用在哪 / 是什么→为什么→怎么办);无递进关系的独立问题拆开,不硬凑一题。
4. 概念层次不得混乱:不同层次的概念不得并列或混用(如把上层概念和其实现机制当同义词)。
5. focus 写"考察什么",不是答案摘要:不得把答案结论写进 focus。
6. 技术内容必须准确:不出事实性/技术性硬错误,不编造不存在的 API 或特性。`;
}

export function buildUserPrompt(opts: GenerateOptions): string {
  const lines = [`知识点:${opts.topic}`];
  if (opts.difficulty) lines.push(`难度:全部为「${opts.difficulty}」`);
  lines.push('按 system 中的要求(含数量判断)出题,只输出 JSON 数组。');
  return lines.join('\n');
}

// ===== 解析(容错:剥 markdown 围栏、截取首尾方括号) =====

export function parseQuestions(text: string): GeneratedQuestion[] {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('输出中未找到 JSON 数组');
  let arr: unknown;
  try {
    arr = JSON.parse(t.slice(start, end + 1));
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!Array.isArray(arr) || !arr.length) throw new Error('输出不是非空 JSON 数组');
  return arr.map((x) => x as GeneratedQuestion);
}

// ===== 预检(共享 validateQuestion + 运行时补充检查) =====

export function validateGenerated(qs: GeneratedQuestion[]): string[] {
  const errors: string[] = [];
  qs.forEach((q, i) => {
    const raw: RawQuestion = {
      id: 'draft',
      difficulty: q.difficulty,
      title: q.title,
      focus: q.focus ?? null,
      answer: q.answer,
      followups: q.followups,
    };
    errors.push(...validateQuestion(raw, `第 ${i + 1} 题`));
    if (!Array.isArray(q.tags)) errors.push(`第 ${i + 1} 题: tags 必须是数组`);
  });
  return errors;
}

// ===== 主流程 =====

export interface GenerateResult {
  questions: GeneratedQuestion[];
  retries: number; // 自修正次数(0 = 一次通过)
}

type ChatFn = (messages: ChatMessage[], opts: ChatOptions) => Promise<string>;

// 生成主循环:chat → 解析 → 预检 → 失败喂错误自修正(≤ MAX_RETRIES)。知识点/JD 两种模式共用。
async function generateWithRetry(
  messages: ChatMessage[],
  chatOpts: ChatOptions,
  chat: ChatFn,
): Promise<GenerateResult> {
  let msgs = messages;
  let retries = 0;

  for (;;) {
    const text = await chat(msgs, chatOpts);
    let errors: string[];
    let questions: GeneratedQuestion[] = [];
    try {
      questions = parseQuestions(text);
      errors = validateGenerated(questions);
    } catch (e) {
      errors = [e instanceof Error ? e.message : String(e)];
    }

    if (!errors.length) return { questions, retries };
    if (retries >= MAX_RETRIES) {
      throw new Error(`生成 ${retries + 1} 次仍未通过校验:\n${errors.join('\n')}`);
    }
    retries++;
    // 自修正:把错误清单喂回去,要求重出完整 JSON
    msgs = [
      ...msgs,
      { role: 'assistant', content: text },
      { role: 'user', content: `你上次的输出未通过校验,问题如下:\n${errors.join('\n')}\n\n请修正所有问题,重新输出完整的 JSON 数组(只输出 JSON,遵守全部格式与设计要求)。` },
    ];
  }
}

export async function generateQuestions(
  opts: GenerateOptions,
  chatOpts: ChatOptions,
  chat: ChatFn = defaultChat,
): Promise<GenerateResult> {
  if (!opts.topic.trim()) throw new Error('知识点不能为空');

  return generateWithRetry(
    [
      { role: 'system', content: buildSystemPrompt(opts) },
      { role: 'user', content: buildUserPrompt(opts) },
    ],
    chatOpts,
    chat,
  );
}

// ===== JD 定向生题(阶段 2 功能④,ADR-4:档案作为生成上下文) =====

export interface JdGenerateOptions {
  difficulty?: Difficulty;
  includeResume: boolean; // 档案里有简历且开关打开才注入
}

export function buildJdSystemPrompt(opts: JdGenerateOptions): string {
  return `你是一名资深技术面试官,正在为候选人准备一场针对目标岗位的定向面试。请基于给定的职位描述(JD)出面试题,使用中文。

出题数量由你根据 JD 的技术要求广度判断:
- 聚焦单一技术栈/初级岗位:2~5 道
- 复合技术栈/资深岗位:5~10 道
- 无论如何不超过 12 道
每道题必须对应 JD 里的一个真实考点,宁缺毋滥,不出与 JD 无关的泛知识题。

定向规则:
- 按 JD 技术要求的重要性出题:核心必备项优先,加分项其次
${opts.includeResume ? '- 候选人简历也会提供:结合简历声称的经历出深挖题(如项目里写到的技术,考察是否真掌握、能否达到 JD 要求),但不针对与 JD 无关的简历内容\n' : ''}
输出格式(硬性要求):
- 只输出一个 JSON 数组,不要 markdown 代码围栏,不要任何其他文字或解释。
- 每个元素是一个对象,字段如下:
  - "difficulty": 只能是 "初"、"中"、"高" 之一
  - "title": 题干(一个问句或指令,自包含,不加编号前缀)
  - "focus": 考察点(一句话说明对应 JD 的哪条要求/考察什么,不超过 40 字)
  - "answer": 答案数组(字符串数组,每条一个要点,所有条目合计不少于 50 字,技术准确、有深度)
  - "followups": 追问数组(字符串数组,可为空数组)
  - "tags": 标签数组(字符串数组,1~4 个)
${opts.difficulty ? `- 全部题目的 difficulty 必须是 "${opts.difficulty}"\n` : '- 难度分布合理:初/中/高搭配,以中为主\n'}
题目设计红线(违反任何一条都会被拒):
1. 答案不得泄漏进题干:题干后半句不得回答前半句,题干本身不得包含答题人该自己想到的要点。
2. 追问不得隐含答案:不点名题干该考的区分点,括号里不得给提示或答案。
3. 一题只考一条主线:多个子问题必须有递进关系;无递进关系的独立问题拆开,不硬凑一题。
4. 概念层次不得混乱:不同层次的概念不得并列或混用。
5. focus 写"考察什么",不是答案摘要:不得把答案结论写进 focus。
6. 技术内容必须准确:不出事实性/技术性硬错误,不编造不存在的 API 或特性。`;
}

// JD 定向上下文(求职中枢一期):JD 条目 + 可选简历,不再吃整个 profile
export interface JdContext {
  company: string;
  content: string;
  resume?: string;
}

export function buildJdUserPrompt(jd: JdContext): string {
  const lines = [`目标公司:${jd.company.trim() || '(未填写)'}`, '', '职位描述(JD):', jd.content.trim()];
  if (jd.resume && jd.resume.trim()) {
    lines.push('', '候选人简历:', jd.resume.trim(), '', '结合简历与 JD 出题(简历深挖题应考察 JD 要求与简历声称能力的匹配)。');
  }
  lines.push('', '按 system 中的要求(含数量判断)出题,只输出 JSON 数组。');
  return lines.join('\n');
}

export async function generateJdQuestions(
  jd: JdContext,
  opts: JdGenerateOptions,
  chatOpts: ChatOptions,
  chat: ChatFn = defaultChat,
): Promise<GenerateResult> {
  if (!jd.content.trim()) throw new Error('JD 内容为空——先去「求职中枢」填写职位描述');

  return generateWithRetry(
    [
      { role: 'system', content: buildJdSystemPrompt(opts) },
      { role: 'user', content: buildJdUserPrompt(jd) },
    ],
    chatOpts,
    chat,
  );
}
