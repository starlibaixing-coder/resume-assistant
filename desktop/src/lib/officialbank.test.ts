// 官方题库物化 + 同步 —— diff/校验纯函数 + 同步落库契约(fetch/db 全 mock)
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type Database from '@tauri-apps/plugin-sql';
import type { Question, QuestionData } from '@/types/question';
import {
  diffOfficial,
  validateRemoteBank,
  syncOfficialBank,
  getOfficial,
  _resetOfficialForTest,
  _setOfficialDbForTest,
} from './officialbank';

function q(id: string, partial: Partial<Question> = {}): Question {
  return {
    id,
    category: id.split('.')[0],
    module: parseInt(id.split('.')[1] ?? '1', 10),
    moduleName: '模块',
    index: parseInt(id.split('.')[2] ?? '1', 10),
    type: 'qa',
    difficulty: '中',
    tags: ['t'],
    title: `题干 ${id}`,
    focus: '考察点',
    answer: ['a'.repeat(60)],
    followups: [],
    ...partial,
  };
}

function bank(questions: Question[]): QuestionData {
  const slugs = [...new Set(questions.map((x) => x.category))];
  return {
    categories: slugs.map((slug) => ({ slug, name: slug, description: '', modules: [], count: 0 })),
    questions,
    total: questions.length,
  };
}

function mockDb() {
  return { execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }), select: vi.fn().mockResolvedValue([]) } as unknown as Database;
}

beforeEach(() => _resetOfficialForTest());
afterEach(() => vi.unstubAllGlobals());

// ===== diff =====

describe('diffOfficial', () => {
  it('新增 / 修订 / 移除 三分类', () => {
    const local = [q('fe.01.1'), q('fe.01.2'), q('fe.02.1')];
    const remote = [q('fe.01.1'), q('fe.01.2', { title: '改过的题干' }), q('fe.03.1')];
    const d = diffOfficial(local, remote);
    expect(d.added.map((x) => x.id)).toEqual(['fe.03.1']);
    expect(d.updated.map((x) => x.id)).toEqual(['fe.01.2']);
    expect(d.removedIds).toEqual(['fe.02.1']);
  });

  it('完全一致时全空', () => {
    const qs = [q('fe.01.1')];
    expect(diffOfficial(qs, [q('fe.01.1')])).toEqual({ added: [], updated: [], removedIds: [] });
  });
});

// ===== 远端校验 =====

describe('validateRemoteBank', () => {
  it('合法数据通过', () => {
    expect(() => validateRemoteBank(bank([q('fe.01.1')]))).not.toThrow();
  });

  it('缺 categories / questions 拒绝', () => {
    expect(() => validateRemoteBank({ questions: [q('fe.01.1')] })).toThrow('categories');
    const cats = [{ slug: 'fe', name: 'fe', description: '', modules: [], count: 0 }];
    expect(() => validateRemoteBank({ categories: cats })).toThrow('questions');
  });

  it('id 重复拒绝', () => {
    expect(() => validateRemoteBank(bank([q('fe.01.1'), q('fe.01.1')]))).toThrow('重复');
  });

  it('引用未知分类拒绝', () => {
    const b = bank([q('fe.01.1')]);
    b.questions[0].category = 'ghost';
    expect(() => validateRemoteBank(b)).toThrow('未知分类');
  });

  it('非法难度拒绝', () => {
    const b = bank([q('fe.01.1', { difficulty: 'expert' as Question['difficulty'] })]);
    expect(() => validateRemoteBank(b)).toThrow('难度非法');
  });
});

// ===== 同步主流程(fetch + db 全 mock) =====

describe('syncOfficialBank', () => {
  const BASE = bank([q('fe.01.1'), q('fe.01.2')]);

  function stubFetchFor(remote: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => ({
        ok: true,
        json: async () => (String(url).includes('resume-assistant') ? remote : BASE),
      })) as unknown as typeof fetch,
    );
  }

  it('首次播种 + 增量同步:upsert 差异、移除连带清进度/笔记', async () => {
    const db = mockDb();
    _setOfficialDbForTest(db);
    // 注:测试环境 isTauri=false,ensureOfficial 走 fetch 包内(BASE=fe.01.1+fe.01.2)作本地;
    // 远端 REMOTE = fe.01.1 修订 + fe.03.1 新增,fe.01.2 下架 → 1 改 1 增 1 删
    const REMOTE = bank([q('fe.01.1', { title: '修订题干' }), q('fe.03.1')]);
    stubFetchFor(REMOTE);

    const stats = await syncOfficialBank();
    expect(stats).toEqual({ added: 1, updated: 1, removed: 1 });
    expect(getOfficial()?.total).toBe(2);

    const sqls = (db.execute as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(sqls.filter((s) => s.includes('INSERT INTO official_questions')).length).toBe(2); // 新增+修订
    expect(sqls.filter((s) => s.includes('DELETE FROM official_questions')).length).toBe(1);
    expect(sqls.filter((s) => s.includes('DELETE FROM review_state')).length).toBe(1);
    expect(sqls.filter((s) => s.includes('DELETE FROM notes')).length).toBe(1);
    expect(sqls.some((s) => s.includes('INSERT INTO official_categories'))).toBe(true);
  });

  it('远端 HTTP 非 2xx 抛错,本地不动', async () => {
    _setOfficialDbForTest(mockDb());
    stubFetchFor(bank([]));
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (url: unknown) =>
      String(url).includes('resume-assistant')
        ? { ok: false, status: 503, json: async () => ({}) }
        : { ok: true, json: async () => BASE },
    );
    await expect(syncOfficialBank()).rejects.toThrow('HTTP 503');
  });

  it('远端结构坏(id 重复)抛错,缓存保持原样', async () => {
    _setOfficialDbForTest(mockDb());
    stubFetchFor({ ...bank([q('fe.01.1')]), questions: [q('fe.01.1'), q('fe.01.1')] });
    await expect(syncOfficialBank()).rejects.toThrow('重复');
    expect(getOfficial()?.total).toBe(BASE.total); // 播种后的本地未被污染
  });
});
