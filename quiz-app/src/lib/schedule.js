// 调度：算今日待复习队列、统计进度
import { newCard, isDue } from './sm2.js';
import { loadProgress } from './storage.js';

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

  // 待复习优先，不够再用新题补
  const queue = [...dueIds, ...unseen].slice(0, limit);
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
