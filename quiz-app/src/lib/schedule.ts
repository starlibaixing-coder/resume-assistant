// 调度：算今日待复习队列、统计进度
import type { Question } from '@/types/question';
import { isDue, isMastered, type CardState } from './sm2';
import { loadProgress } from './storage';

// 重新导出 isMastered,保持「从 schedule 引入 isMastered」的旧调用方可用
export { isMastered };

export type QuestionStatus = 'unseen' | 'due' | 'learning' | 'mastered';

export interface ModuleStats {
  total: number;
  learned: number;
  mastered: number;
  dueToday: number;
  byDifficulty: Record<string, { total: number; learned: number }>;
}

// 返回该分类下今日待复习 + 从未学过的题 id 列表
// 待复习优先（按 due 升序），新题在后
export function getReviewQueue(
  category: string,
  allQuestionIds: string[],
  limit: number = 50,
): { dueIds: string[]; unseen: string[]; queue: string[] } {
  const progress = loadProgress(category);
  const due: Array<{ id: string; due: number }> = [];
  const unseen: string[] = [];

  for (const id of allQuestionIds) {
    const card = progress[id];
    if (!card) {
      unseen.push(id);
    } else if (isDue(card)) {
      due.push({ id, due: card.due });
    }
  }

  due.sort((a, b) => a.due - b.due);
  const dueIds = due.map((d) => d.id);

  // 待复习优先，不够再用新题补;limit=0 表示不限制
  const queue = limit > 0 ? [...dueIds, ...unseen].slice(0, limit) : [...dueIds, ...unseen];
  return { dueIds, unseen, queue };
}

// 统计某分类的进度概览
export function getStats(
  category: string,
  allQuestionIds: string[],
): { total: number; learned: number; dueToday: number; remaining: number } {
  const progress = loadProgress(category);
  let learned = 0;
  let dueToday = 0;
  let total = allQuestionIds.length;

  for (const id of allQuestionIds) {
    const card = progress[id];
    if (card) {
      learned++;
      if (isDue(card)) dueToday++;
    }
  }

  return { total, learned, dueToday, remaining: total - learned };
}

// 模块级 + 难度级统计:按 module 分组,每组返回 total/learned/mastered/dueToday + 按难度的掌握分布
// 入参 questions 为对象数组(含 id/module/difficulty 字段),内部只读一次 localStorage
export function getModuleStats(category: string, questions: Question[]): Record<number, ModuleStats> {
  const progress = loadProgress(category);
  const byModule: Record<number, ModuleStats> = {};

  for (const q of questions) {
    const mod = q.module;
    if (!byModule[mod]) {
      byModule[mod] = {
        total: 0, learned: 0, mastered: 0, dueToday: 0,
        byDifficulty: { 初: { total: 0, learned: 0 }, 中: { total: 0, learned: 0 }, 高: { total: 0, learned: 0 } },
      };
    }
    const m = byModule[mod];
    m.total++;
    const d = m.byDifficulty[q.difficulty];
    if (d) d.total++;
    const card: CardState | undefined = progress[q.id];
    if (card) {
      m.learned++;
      if (d) d.learned++;
      if (isMastered(card)) m.mastered++;
      if (isDue(card)) m.dueToday++;
    }
  }

  return byModule;
}

// 单题掌握状态:用于浏览页筛选
export function getQuestionStatus(category: string, id: string): QuestionStatus {
  const progress = loadProgress(category);
  const card = progress[id];
  if (!card) return 'unseen';
  if (isDue(card)) return 'due';
  return isMastered(card) ? 'mastered' : 'learning';
}
