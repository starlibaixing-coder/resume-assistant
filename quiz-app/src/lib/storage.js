// localStorage 进度存储（按分类隔离）
// key: quiz-progress:{category} -> { "{id}": cardState, ... }

export function loadProgress(category) {
  const key = `quiz-progress:${category}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

export function saveCard(category, id, card) {
  const key = `quiz-progress:${category}`;
  const all = loadProgress(category);
  all[id] = card;
  localStorage.setItem(key, JSON.stringify(all));
}

export function getCard(category, id) {
  const all = loadProgress(category);
  return all[id] || null;
}

// 清空某分类的全部进度
export function clearProgress(category) {
  const key = `quiz-progress:${category}`;
  localStorage.removeItem(key);
}
