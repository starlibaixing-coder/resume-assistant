// 用户偏好(非敏感,localStorage)。设置页写入,队列/刷题页读取。

const LIMIT_KEY = 'quiz-limit';

// 每次学习题量,0 = 全部
export const LIMIT_OPTIONS = [20, 50, 100, 0] as const;
export const DEFAULT_LIMIT = 50;

export function loadLimit(): number {
  try {
    const raw = localStorage.getItem(LIMIT_KEY);
    if (raw == null) return DEFAULT_LIMIT;
    const n = parseInt(raw, 10);
    return LIMIT_OPTIONS.includes(n as (typeof LIMIT_OPTIONS)[number]) ? n : DEFAULT_LIMIT;
  } catch {
    return DEFAULT_LIMIT;
  }
}

export function saveLimit(n: number): void {
  try {
    localStorage.setItem(LIMIT_KEY, String(n));
  } catch {
    // 隐私模式静默
  }
}
