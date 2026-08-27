// 存储层(B 方案:内存缓存 + SQLite 持久化)—— cache 逻辑 + persist 契约
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadProgress,
  saveCard,
  getCard,
  clearProgress,
  saveNote,
  getNote,
  clearNotes,
  getCodeDraft,
  saveCodeDraft,
  rowToCard,
  _resetStorageForTest,
  _setDbForTest,
  type ReviewRow,
} from './storage';
import type { CardState } from './sm2';

const CAT = 'agent';

function card(partial: Partial<CardState> = {}): CardState {
  return { due: 0, interval: 1, ease: 2.5, reps: 1, lastReview: 0, ...partial };
}

beforeEach(() => _resetStorageForTest());

describe('rowToCard', () => {
  it('SQLite 行映射到 CardState', () => {
    const row: ReviewRow = { id: 'a', category: 't', interval: 3, ease: 2.6, reps: 2, due: 100, last_review: 50 };
    expect(rowToCard(row)).toEqual({ due: 100, interval: 3, ease: 2.6, reps: 2, lastReview: 50 });
  });

  it('last_review null → lastReview null', () => {
    const row = { id: '', category: '', interval: 1, ease: 2.5, reps: 1, due: 0, last_review: null };
    expect(rowToCard(row as ReviewRow).lastReview).toBeNull();
  });
});

describe('进度缓存(同步 API)', () => {
  it('saveCard/getCard 往返', () => {
    saveCard(CAT, 'a', card({ interval: 5 }));
    expect(getCard(CAT, 'a')?.interval).toBe(5);
  });

  it('loadProgress 返回副本(改副本不污染缓存)', () => {
    saveCard(CAT, 'a', card());
    const p = loadProgress(CAT);
    p['a'] = { ...p['a'], interval: 999 };
    expect(getCard(CAT, 'a')?.interval).toBe(1);
  });

  it('loadProgress 空分类返回 {}', () => {
    expect(loadProgress('nope')).toEqual({});
  });

  it('clearProgress 清除', () => {
    saveCard(CAT, 'a', card());
    clearProgress(CAT);
    expect(getCard(CAT, 'a')).toBeNull();
  });

  it('分类隔离', () => {
    saveCard(CAT, 'a', card({ interval: 1 }));
    saveCard('fe', 'a', card({ interval: 9 }));
    expect(getCard(CAT, 'a')?.interval).toBe(1);
    expect(getCard('fe', 'a')?.interval).toBe(9);
  });
});

describe('笔记缓存', () => {
  it('saveNote/getNote 往返', () => {
    saveNote(CAT, 'a', '<p>n</p>');
    expect(getNote(CAT, 'a')).toBe('<p>n</p>');
  });

  it('空内容删除', () => {
    saveNote(CAT, 'a', '<p>n</p>');
    saveNote(CAT, 'a', '   ');
    expect(getNote(CAT, 'a')).toBe('');
  });

  it('getNote 不存在返回空串', () => {
    expect(getNote(CAT, 'x')).toBe('');
  });

  it('笔记与进度隔离', () => {
    saveCard(CAT, 'a', card());
    saveNote(CAT, 'a', '<p>n</p>');
    clearNotes(CAT);
    expect(getCard(CAT, 'a')?.interval).toBe(1);
    expect(getNote(CAT, 'a')).toBe('');
  });
});

describe('代码草稿纸缓存', () => {
  it('saveCodeDraft/getCodeDraft 往返', () => {
    saveCodeDraft(CAT, 'a', 'console.log(1)');
    expect(getCodeDraft(CAT, 'a')).toBe('console.log(1)');
  });

  it('空白内容删除', () => {
    saveCodeDraft(CAT, 'a', 'console.log(1)');
    saveCodeDraft(CAT, 'a', '   ');
    expect(getCodeDraft(CAT, 'a')).toBe('');
  });

  it('getCodeDraft 不存在返回空串', () => {
    expect(getCodeDraft(CAT, 'x')).toBe('');
  });

  it('与笔记隔离(同 id 互不干扰)', () => {
    saveNote(CAT, 'a', '<p>n</p>');
    saveCodeDraft(CAT, 'a', 'let x = 1');
    clearNotes(CAT);
    expect(getCodeDraft(CAT, 'a')).toBe('let x = 1');
  });
});

describe('persist 契约(mock db)', () => {
  it('saveCard 触发 review_state UPSERT(参数顺序正确)', async () => {
    const execute = vi.fn().mockResolvedValue({});
    _setDbForTest({ execute, select: vi.fn() } as never);
    saveCard(CAT, 'a', card({ interval: 5, ease: 2.6, reps: 2, due: 100, lastReview: 50 }));
    await vi.waitFor(() => expect(execute).toHaveBeenCalled());
    const [sql, args] = execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO review_state');
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(args).toEqual(['a', CAT, 5, 2.6, 2, 100, 50]);
  });

  it('saveNote 非空 UPSERT / 空 DELETE', async () => {
    const execute = vi.fn().mockResolvedValue({});
    _setDbForTest({ execute, select: vi.fn() } as never);
    saveNote(CAT, 'a', '<p>n</p>');
    await vi.waitFor(() => expect(execute).toHaveBeenCalled());
    expect(execute.mock.calls[0][0]).toContain('INSERT INTO notes');
    execute.mockClear();
    saveNote(CAT, 'a', '');
    await vi.waitFor(() => expect(execute).toHaveBeenCalled());
    expect(execute.mock.calls[0][0]).toContain('DELETE FROM notes');
  });

  it('saveCodeDraft 非空 UPSERT / 空 DELETE', async () => {
    const execute = vi.fn().mockResolvedValue({});
    _setDbForTest({ execute, select: vi.fn() } as never);
    saveCodeDraft(CAT, 'a', 'let x = 1');
    await vi.waitFor(() => expect(execute).toHaveBeenCalled());
    const [sql, args] = execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO code_drafts');
    expect(args).toEqual(['a', CAT, 'let x = 1', expect.any(Number)]);
    execute.mockClear();
    saveCodeDraft(CAT, 'a', '  ');
    await vi.waitFor(() => expect(execute).toHaveBeenCalled());
    expect(execute.mock.calls[0][0]).toContain('DELETE FROM code_drafts');
  });

  it('db 未就绪时 persist 静默跳过(不抛错)', () => {
    _resetStorageForTest();
    expect(() => saveCard(CAT, 'a', card())).not.toThrow();
  });
});
