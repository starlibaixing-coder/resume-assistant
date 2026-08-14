// 共享校验规则 —— build.mjs / audit.mjs / 运行时复用同一份(ADR-9 id 不可变 / ADR-10 质量闸)
// 一份 TS 源: 脚本侧用 tsx 桥接跑 TS, 运行时 Vite 直接 import
//
// 设计: 只抽"格式校验"和"id 校验"这类跨场景共用的硬规则;
// audit.mjs 的设计启发式检查(focus 泄漏/多问/括号提示等)留在 audit 专属,不在此(它们依赖 QUALITY.md 语义,非纯格式)。

export const VALID_DIFFICULTIES = ['初', '中', '高'];
export const MIN_ANSWER_CHARS = 50;

// 原始 YAML 题目结构(id 为两段 "模块号.题号",未拼分类 slug)
export interface RawQuestion {
  id?: string;
  difficulty?: string;
  title?: string;
  focus?: string | null;
  answer?: unknown;
  followups?: unknown;
}

// 格式校验: 返回错误信息数组(空 = 通过)。抽 build.mjs / audit.mjs 共用的部分。
export function validateQuestion(q: RawQuestion, loc: string): string[] {
  const errors: string[] = [];
  if (!q.id) errors.push(`${loc}: 缺 id`);
  if (!q.difficulty) errors.push(`${loc}: 缺 difficulty`);
  else if (!VALID_DIFFICULTIES.includes(q.difficulty))
    errors.push(`${loc}: difficulty "${q.difficulty}" 不合法(只能 初/中/高)`);
  if (!q.title) errors.push(`${loc}: 缺 title`);
  if (q.focus == null) errors.push(`${loc}: 缺 focus`); // ==null 容忍空串,只拦 null/undefined
  if (!Array.isArray(q.answer)) errors.push(`${loc}: answer 必须是数组`);
  else {
    const len = (q.answer as string[]).join('').length;
    if (len < MIN_ANSWER_CHARS) errors.push(`${loc}: 答案过短(${len}字 < ${MIN_ANSWER_CHARS})`);
  }
  if (!Array.isArray(q.followups)) errors.push(`${loc}: followups 必须是数组`);
  return errors;
}

// id 不可变(ADR-9): 返回"历史 baseline 有、而新集合没有"的 id —— 即被删除/改名的题。
// 允许新增(baseline 没有、new 有的不报),只拦消失。
export function checkIdImmutability(newIds: Iterable<string>, baselineIds: Iterable<string>): string[] {
  const newSet = new Set(newIds);
  const errors: string[] = [];
  for (const id of baselineIds) {
    if (!newSet.has(id)) errors.push(`id 消失(不可变约定): ${id}`);
  }
  return errors;
}

// id 三段一致性: q.id("模块号.题号")的第一段须等于该文件的模块号。
// 用 parseInt 比较,容错前导零(01 == 1)。补 build.mjs 原先零校验的隐患。
export function checkIdSegmentConsistency(qId: string, fileModule: number | string, loc: string): string[] {
  const seg = String(qId).split('.')[0];
  if (parseInt(seg, 10) !== parseInt(String(fileModule), 10)) {
    return [`${loc}: id 段"${seg}"与文件模块号${fileModule}不一致`];
  }
  return [];
}
