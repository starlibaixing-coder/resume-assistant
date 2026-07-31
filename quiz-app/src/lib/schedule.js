// 调度：算今日待复习队列、统计进度
import { newCard, isDue } from './sm2.js';
import { loadProgress } from './storage.js';

// 判定一道题是否已掌握:学过且间隔已拉到 >=3 天(SM-2 间隔 1->3->9,>=3 表示至少连续通过 2 次)
export function isMastered(card) {
  return !!card && card.interval >= 3;
}

// 返回该分类下今日待复习 + 从未学过的题 id 列表
// 待复习优先（按 due 升序），新题在后
export function getReviewQueue(category, allQuestionIds, limit = 50) {
  const progress = loadProgress(category);
  const due = [];
  const unseen = [];

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
export function getStats(category, allQuestionIds) {
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
export function getModuleStats(category, questions) {
  const progress = loadProgress(category);
  const byModule = {};

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
    const card = progress[q.id];
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
export function getQuestionStatus(category, id) {
  const progress = loadProgress(category);
  const card = progress[id];
  if (!card) return 'unseen';
  if (isDue(card)) return 'due';
  return isMastered(card) ? 'mastered' : 'learning';
}
