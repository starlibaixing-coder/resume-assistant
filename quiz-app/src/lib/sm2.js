// SM-2 间隔重复算法（三档简化版）
// 评分映射：不会=0(失败) / 模糊=3(勉强) / 掌握=5(轻松)

const DAY_MS = 24 * 60 * 60 * 1000;

// 新题的初始卡片状态
export function newCard() {
  return {
    reps: 0,
    interval: 0,
    ease: 2.5,
    due: Date.now(), // 新题立即可学
    lastReview: null,
  };
}

// 根据评分更新卡片，返回新卡片状态
export function review(card, rating) {
  const qMap = { 不会: 0, 模糊: 3, 掌握: 5 };
  const q = qMap[rating];
  let { reps, interval, ease } = card;
  const now = Date.now();

  if (q < 3) {
    // 失败：重来
    reps = 0;
    interval = 1; // 明天再复习
    ease = Math.max(1.3, ease - 0.2);
  } else {
    // 通过
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    ease = Math.max(1.3, ease);
  }

  return {
    reps,
    interval,
    ease,
    due: now + interval * DAY_MS,
    lastReview: now,
  };
}

// 判断卡片是否到期（今日该复习）
export function isDue(card, now = Date.now()) {
  return card.due <= now;
}
