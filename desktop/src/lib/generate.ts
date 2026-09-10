// 出题管线(§5.4):system prompt 内嵌题库质量六红线;输出 JSON 数组;
// 预检不过 → 错误回传模型自修正,重试 ≤2;仍失败整批丢弃(不产生 pending)。
// 产物逐题落 questions(status='pending',临时 id,source='ai'|'jd'),刷新 jds.last_active_at。

import { chat, LlmError } from './llm';
import { nextPendingId, saveMyQuestion, touchJd } from './storage';
import type { Difficulty, Question } from './types';

export const MAX_QUESTIONS = 12;

export const SIX_RED_LINES = [
  '答案正文不得复述/泄漏题干问句',
  '追问(followups)不得直接给出主答案提示',
  '一题只问一个概念,不得多问一题',
  '不得混淆相近概念(如把 A 的特征写成 B)',
  'focus(考察方向)不得泄漏答案内容',
  'answer 各要点合计不少于 50 字',
];

const SYSTEM_PROMPT = `你是资深前端/AI Agent 面试官与题库编辑,为求职刷题应用生成面试题。
必须遵守以下六条质量红线:
${SIX_RED_LINES.map((l, i) => `${i + 1}. ${l}`).join('\n')}

输出要求:只输出一个 JSON 数组,不要任何其他文字或代码围栏。
数组元素 schema:
{"module": 模块名(字符串), "difficulty": "初"|"中"|"高", "title": 题干, "focus": 考察方向, "answer": ["要点1","要点2",...], "followups": ["追问1",...], "is_code": 是否代码题(true/false,可省略)}
题目数量由知识点/JD 的广度决定,上限 ${MAX_QUESTIONS} 题。answer 用简体中文,每条一个要点,可含 Markdown 粗体与行内代码。`;

// ===== Provider 配置解析(meta 存非敏感配置,secrets 存 key) =====

export interface GenerateConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  ready: boolean;
}

export function resolveConfig(read: (k: string) => string, secret: string): GenerateConfig {
  const baseUrl = read('ll_base_url');
  const model = read('ll_model');
  const apiKey = secret;
  return { apiKey, baseUrl, model, ready: !!(apiKey && baseUrl && model) };
}

// ===== 解析与校验(纯函数,单测锚点) =====

export interface GeneratedQuestion {
  module: string;
  difficulty: Difficulty;
  title: string;
  focus: string;
  answer: string[];
  followups: string[];
  is_code?: boolean;
}

/** 剥围栏、截取首个 '[' 到最后一个 ']' 之间、JSON.parse */
export function parseQuestionArray(text: string): GeneratedQuestion[] {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('输出中找不到 JSON 数组');
  const parsed: unknown = JSON.parse(t.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('输出不是数组');
  return parsed as GeneratedQuestion[];
}

const VALID_DIFFICULTIES: Difficulty[] = ['初', '中', '高'];

/** 预检(§5.4):题干非空 / focus 非空 / answer 合计 ≥50 字 / difficulty 合法 */
export function validateGenerated(q: GeneratedQuestion): string[] {
  const errors: string[] = [];
  if (!q.title?.trim()) errors.push('题干为空');
  if (!q.focus?.trim()) errors.push('focus 为空');
  const len = (q.answer ?? []).join('').length;
  if (len < 50) errors.push(`答案过短(${len} 字 < 50 字)`);
  if (!VALID_DIFFICULTIES.includes(q.difficulty)) errors.push(`difficulty 不合法:${q.difficulty}`);
  if (!Array.isArray(q.answer) || q.answer.length === 0) errors.push('answer 必须是非空数组');
  return errors;
}

// ===== 生成入口 =====

export interface GenerateRequest {
  kind: 'ai' | 'jd';
  /** kind='ai':知识点;kind='jd':JD 全文 */
  prompt: string;
  /** kind='jd' 时的岗位名(写 source_ref 快照) */
  jdTitle?: string;
  jdId?: number;
  resume?: string;
}

export interface GenerateOutcome {
  saved: Question[];
  attempts: number;
}

export async function generateQuestions(req: GenerateRequest, cfg: GenerateConfig): Promise<GenerateOutcome> {
  if (!cfg.ready) throw new LlmError('key', 'AI 服务未配置');
  const userParts: string[] = [];
  if (req.kind === 'ai') {
    userParts.push(`请围绕知识点「${req.prompt}」出一组面试题。`);
  } else {
    userParts.push(`请根据以下 JD 生成面试题:\n\n${req.prompt}`);
  }
  if (req.resume?.trim()) {
    userParts.push(`\n请适当结合候选人简历背景出题:\n\n${req.resume}`);
  }

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ];

  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const text = await chat(messages, cfg);
    let parsed: GeneratedQuestion[];
    try {
      parsed = parseQuestionArray(text);
    } catch (e) {
      lastError = `生成结果无效:${e instanceof Error ? e.message : String(e)}`;
      messages.push({ role: 'assistant', content: text.slice(0, 2000) });
      messages.push({ role: 'user', content: `${lastError}。请只输出合法 JSON 数组重新生成。` });
      continue;
    }
    const sliced = parsed.slice(0, MAX_QUESTIONS);
    const problems = sliced.map((q, i) => ({ i, errors: validateGenerated(q) })).filter((x) => x.errors.length > 0);
    if (problems.length > 0) {
      lastError = problems.map((p) => `第 ${p.i + 1} 题:${p.errors.join(';')}`).join(' ');
      messages.push({ role: 'assistant', content: text.slice(0, 4000) });
      messages.push({ role: 'user', content: `以下题目未通过质量预检:\n${lastError}\n请修正后重新输出完整 JSON 数组。` });
      continue;
    }
    return { saved: persistPending(sliced, req), attempts: attempt };
  }
  throw new LlmError('parse', `${lastError};已自动重试仍失败,整批丢弃`);
}

function persistPending(list: GeneratedQuestion[], req: GenerateRequest): Question[] {
  const now = Date.now();
  const saved: Question[] = [];
  list.forEach((q, i) => {
    const question: Question = {
      id: `${nextPendingId()}.${i}`,
      origin: 'my',
      category: 'my',
      module: 0,
      moduleName: q.module || (req.kind === 'jd' ? req.jdTitle ?? '自定义' : '自定义'),
      index: i + 1,
      difficulty: q.difficulty,
      title: q.title.trim(),
      focus: q.focus.trim(),
      answer: q.answer.map(String),
      followups: (q.followups ?? []).map(String),
      tags: req.kind === 'jd' ? ['JD'] : ['AI'],
      status: 'pending',
      source: req.kind,
      sourceId: null,
      sourceRef: req.kind === 'ai' ? `AI 生成 · 知识点「${req.prompt.slice(0, 24)}」` : `按 JD 生成 · ${req.jdTitle ?? ''}`,
      jdId: req.kind === 'jd' ? req.jdId ?? null : null,
      isCode: !!q.is_code,
      createdAt: now,
      updatedAt: now,
    };
    saveMyQuestion(question);
    saved.push(question);
  });
  if (req.kind === 'jd' && req.jdId != null) touchJd(req.jdId);
  return saved;
}

// ===== 测试连接(D10):1 条最小消息 =====

export async function testConnection(cfg: GenerateConfig): Promise<void> {
  await chat([{ role: 'user', content: 'ping' }], cfg);
}
