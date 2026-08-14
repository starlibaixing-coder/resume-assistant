// localStorage 存储层 —— key 隔离 / 往返 / 损坏降级(WP4 抽象时的契约参考)
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress, saveCard, getCard, clearProgress,
  loadNotes, saveNote, getNote, clearNotes,
} from './storage';
import type { CardState } from './sm2';

const CAT = 'agent';

function card(partial: Partial<CardState> = {}): CardState {
  return { due: 0, interval: 1, ease: 2.5, reps: 1, lastReview: 0, ...partial };
}

beforeEach(() => {
  localStorage.clear();
});

describe('进度存储', () => {
  it('saveCard/getCard 往返', () => {
    saveCard(CAT, 'a', card({ interval: 5 }));
    expect(getCard(CAT, 'a')?.interval).toBe(5);
  });

  it('loadProgress 空返回 {}', () => {
    expect(loadProgress(CAT)).toEqual({});
  });

  it('JSON 损坏返回 {}(不抛错)', () => {
    localStorage.setItem('quiz-progress:agent', '{invalid');
    expect(loadProgress(CAT)).toEqual({});
  });

  it('clearProgress 清除', () => {
    saveCard(CAT, 'a', card());
    clearProgress(CAT);
    expect(getCard(CAT, 'a')).toBeNull();
  });

  it('分类隔离(不同 category 互不干扰)', () => {
    saveCard(CAT, 'a', card({ interval: 1 }));
    saveCard('fe', 'a', card({ interval: 9 }));
    expect(getCard(CAT, 'a')?.interval).toBe(1);
    expect(getCard('fe', 'a')?.interval).toBe(9);
  });
});

describe('笔记存储', () => {
  it('saveNote/getNote 往返', () => {
    saveNote(CAT, 'a', '<p>n</p>');
    expect(getNote(CAT, 'a')).toBe('<p>n</p>');
  });

  it('空内容删除 key(不留垃圾)', () => {
    saveNote(CAT, 'a', '<p>n</p>');
    saveNote(CAT, 'a', '   ');
    expect(getNote(CAT, 'a')).toBe('');
  });

  it('getNote 不存在返回空串', () => {
    expect(getNote(CAT, 'nope')).toBe('');
  });

  it('笔记与进度隔离(清笔记不影响进度,反之亦然)', () => {
    saveCard(CAT, 'a', card());
    saveNote(CAT, 'a', '<p>n</p>');
    clearNotes(CAT);
    expect(getCard(CAT, 'a')?.interval).toBe(1);
    expect(getNote(CAT, 'a')).toBe('');
  });
});
