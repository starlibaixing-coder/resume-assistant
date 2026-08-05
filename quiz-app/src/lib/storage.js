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

// ===== 笔记存储 =====
// key: quiz-notes-v2:{category} -> { "{id}": "HTML字符串" }
// v2:内容从 markdown 改为 HTML(Tiptap WYSIWYG)。旧 quiz-notes: key 废弃不读。
// 与 SM-2 进度数据隔离,清进度不影响笔记

export function loadNotes(category) {
  const key = `quiz-notes-v2:${category}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

export function saveNote(category, id, html) {
  const key = `quiz-notes-v2:${category}`;
  try {
    const all = loadNotes(category);
    if (html && html.trim()) {
      all[id] = html;
    } else {
      delete all[id]; // 空内容不留 key
    }
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // 隐私模式/配额满,静默降级
  }
}

export function getNote(category, id) {
  return loadNotes(category)[id] || '';
}

export function clearNotes(category) {
  const key = `quiz-notes-v2:${category}`;
  try {
    localStorage.removeItem(key);
  } catch {
    // 静默
  }
}
