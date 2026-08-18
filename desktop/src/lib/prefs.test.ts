// 用户偏好 —— 题量存取(localStorage)
import { describe, it, expect, beforeEach } from 'vitest';
import { loadLimit, saveLimit, LIMIT_OPTIONS, DEFAULT_LIMIT } from './prefs';

beforeEach(() => localStorage.clear());

describe('limit', () => {
  it('默认 50', () => {
    expect(loadLimit()).toBe(DEFAULT_LIMIT);
  });

  it('save/load 往返(含 0=全部)', () => {
    saveLimit(20);
    expect(loadLimit()).toBe(20);
    saveLimit(0);
    expect(loadLimit()).toBe(0);
  });

  it('非法值回退默认', () => {
    localStorage.setItem('quiz-limit', '33');
    expect(loadLimit()).toBe(DEFAULT_LIMIT);
    localStorage.setItem('quiz-limit', 'abc');
    expect(loadLimit()).toBe(DEFAULT_LIMIT);
  });

  it('选项集合包含 0/20/50/100', () => {
    expect([...LIMIT_OPTIONS]).toEqual([20, 50, 100, 0]);
  });
});
