import { loadProgress } from './storage';
import { getMyQuestions } from './mylib';
import { getJds } from './jd';
import { isMastered, type CardState } from './sm2';

// 最近动态(2026-09-03 工作台总览):不落新表,从本地数据推导四类事件——
// 学习(review_state.last_review 按天×分类聚合)/ 生成(我的题 source=ai|jd 仍 pending,
// 按 created_at 天×模块聚合)/ 通过(pending→approved 的 updatedAt)/ 添加 JD(jds.created_at)。
// 纯分组函数导出便于单测;查询入口 getRecentActivity 负责窗口过滤、排序与截断。

export interface StudyActivity {
  kind: 'study';
  time: number;
  categorySlug: string;
  categoryName: string;
  count: number;
  masteredCount: number;
}
export interface GeneratedActivity {
  kind: 'generated';
  time: number;
  moduleName: string;
  count: number;
}
export interface ApprovedActivity {
  kind: 'approved';
  time: number;
  moduleName: string;
  count: number;
}
export interface JdActivity {
  kind: 'jd';
  time: number;
  title: string;
  company: string;
}
export type Activity = StudyActivity | GeneratedActivity | ApprovedActivity | JdActivity;

export interface CategoryRef {
  slug: string;
  name: string;
}

// 本地时区的 YYYY-MM-DD(聚合键)
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 相对时间标签:同日 HH:mm / 昨天 / M 月 D 日
export function formatActivityTime(ts: number, now: number = Date.now()): string {
  const t = new Date(ts);
  const n = new Date(now);
  if (dayKey(ts) === dayKey(now)) {
    return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
  if (t.getFullYear() === yesterday.getFullYear() && t.getMonth() === yesterday.getMonth() && t.getDate() === yesterday.getDate()) {
    return '昨天';
  }
  return `${t.getMonth() + 1} 月 ${t.getDate()} 日`;
}

interface DayAcc {
  count: number;
  masteredCount: number;
  latest: number;
}

function bump(acc: Map<string, DayAcc>, ts: number, mastered: boolean): void {
  const k = dayKey(ts);
  const cur = acc.get(k) ?? { count: 0, masteredCount: 0, latest: 0 };
  cur.count += 1;
  if (mastered) cur.masteredCount += 1;
  cur.latest = Math.max(cur.latest, ts);
  acc.set(k, cur);
}

// 学习事件:某分类的卡片按 天 聚合(lastReview 在窗口内)
export function groupStudyByDay(
  cards: Record<string, CardState>,
  categorySlug: string,
  categoryName: string,
  now: number,
  windowMs: number,
): StudyActivity[] {
  const acc = new Map<string, DayAcc>();
  for (const card of Object.values(cards)) {
    if (!card.lastReview || now - card.lastReview > windowMs || card.lastReview > now) continue;
    bump(acc, card.lastReview, isMastered(card));
  }
  return [...acc.entries()].map(([, v]) => ({
    kind: 'study' as const,
    time: v.latest,
    categorySlug,
    categoryName,
    count: v.count,
    masteredCount: v.masteredCount,
  }));
}

// 出题事件:AI/JD 来源的我的题,pending 按 created_at 天聚合,approved 按 updatedAt(=通过时刻)天聚合
export function groupGenerationsByDay(
  questions: ReturnType<typeof getMyQuestions>,
  now: number,
  windowMs: number,
): Array<GeneratedActivity | ApprovedActivity> {
  const pending = new Map<string, DayAcc & { moduleName: string }>();
  const approved = new Map<string, DayAcc & { moduleName: string }>();
  for (const q of questions) {
    if (q.source !== 'ai' && q.source !== 'jd') continue;
    if (q.status === 'pending') {
      if (now - q.createdAt > windowMs || q.createdAt > now) continue;
      const k = `${dayKey(q.createdAt)}|${q.moduleName}`;
      const cur = pending.get(k) ?? { count: 0, masteredCount: 0, latest: 0, moduleName: q.moduleName };
      cur.count += 1;
      cur.latest = Math.max(cur.latest, q.createdAt);
      pending.set(k, cur);
    } else {
      if (now - q.updatedAt > windowMs || q.updatedAt > now) continue;
      const k = `${dayKey(q.updatedAt)}|${q.moduleName}`;
      const cur = approved.get(k) ?? { count: 0, masteredCount: 0, latest: 0, moduleName: q.moduleName };
      cur.count += 1;
      cur.latest = Math.max(cur.latest, q.updatedAt);
      approved.set(k, cur);
    }
  }
  return [
    ...[...pending.values()].map((v) => ({ kind: 'generated' as const, time: v.latest, moduleName: v.moduleName, count: v.count })),
    ...[...approved.values()].map((v) => ({ kind: 'approved' as const, time: v.latest, moduleName: v.moduleName, count: v.count })),
  ];
}

// 查询入口:窗口内(默认 7 天)的四类事件,按时间倒序,默认取 6 条
export function getRecentActivity(
  categories: CategoryRef[],
  opts: { now?: number; windowMs?: number; limit?: number } = {},
): Activity[] {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? 7 * 24 * 60 * 60 * 1000;
  const limit = opts.limit ?? 6;

  const items: Activity[] = [];
  for (const c of categories) {
    items.push(...groupStudyByDay(loadProgress(c.slug), c.slug, c.name, now, windowMs));
  }
  items.push(...groupGenerationsByDay(getMyQuestions(), now, windowMs));
  for (const jd of getJds()) {
    if (now - jd.createdAt > windowMs || jd.createdAt > now) continue;
    items.push({ kind: 'jd', time: jd.createdAt, title: jd.title, company: jd.company });
  }

  items.sort((a, b) => b.time - a.time);
  return items.slice(0, limit);
}
