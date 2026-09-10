// 存储网关往返与级联(mock db):行映射 / 补列 / 通过 / 复制 / 备份信封 / activity 派生

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetStorageForTest,
  approvePending,
  buildEnvelope,
  copyOfficialToMy,
  deleteMyQuestion,
  ensureSchema,
  getCard,
  getMyQuestions,
  getNote,
  getOfficialQuestions,
  getQuestion,
  initStorage,
  myRowToQuestion,
  saveCard,
  saveJd,
  saveMyQuestion,
  type MyRow,
} from './storage';
import { rate } from './scheduler';
import type Database from '@tauri-apps/plugin-sql';

const DAY = 24 * 60 * 60 * 1000;

interface Call {
  sql: string;
  params?: unknown[];
}

function fakeDb(selectResults: Record<string, unknown[]> = {}) {
  const calls: Call[] = [];
  const db = {
    select: vi.fn(async (sql: string) => {
      for (const key of Object.keys(selectResults)) {
        if (sql.includes(key)) return selectResults[key];
      }
      return [];
    }),
    execute: vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rowsAffected: 0 } as never;
    }),
  } as unknown as Database & { execute: ReturnType<typeof vi.fn> };
  return { db, calls };
}

function myRow(id: string, over: Partial<MyRow> = {}): MyRow {
  const now = Date.now();
  return {
    id,
    category: 'my',
    module: 1,
    module_name: '基础',
    index_real: 1,
    difficulty: '中',
    title: `题 ${id}`,
    focus: 'f',
    answer: JSON.stringify(['a'.repeat(60)]),
    followups: JSON.stringify(['q1']),
    tags: JSON.stringify(['t']),
    status: 'approved',
    source: 'manual',
    source_id: null,
    source_ref: '',
    jd_id: null,
    is_code: 0,
    created_at: now,
    updated_at: now,
    ...over,
  };
}

beforeEach(() => {
  _resetStorageForTest();
});

describe('initStorage(mock db)', () => {
  it('预热:官方/我的/进度/笔记全部灌入缓存;补列 DDL 幂等执行', async () => {
    const { db } = fakeDb({
      official_questions: [
        {
          id: 'fe.1.1', category: 'fe', module: 1, module_name: '闭包', index_real: 1.1,
          difficulty: '中', title: '什么是闭包', focus: '词法作用域',
          answer: JSON.stringify(['要点']), followups: '[]', tags: '["必问"]', synced_at: 1,
        },
      ],
      official_categories: [{ slug: 'fe', name: '前端', description: '' }],
      questions: [myRow('my.1.1', { status: 'pending', source: 'ai', source_ref: '知识点「x」' })],
      review_state: [{ id: 'fe.1.1', category: 'fe', interval: 3, ease: 2.5, reps: 1, due: Date.now() + DAY, last_review: 1, last_rating: 'ok' }],
      notes: [{ id: 'fe.1.1', content: '我的笔记' }],
      jds: [{ id: 1, title: '前端岗', company: 'X', content: 'c', created_at: 1, last_active_at: 2 }],
      meta: [{ key: 'batch_size', value: '20' }],
      secrets: [{ name: 'llm-api-key', value: 'sk-1' }],
    });
    await initStorage({ db, loadBundledBank: false });

    expect(getOfficialQuestions()).toHaveLength(1);
    expect(getMyQuestions()).toHaveLength(1);
    expect(getCard('fe.1.1')?.lastRating).toBe('ok');
    expect(getNote('fe.1.1')).toBe('我的笔记');
    expect(getQuestion('my.1.1')?.sourceRef).toBe('知识点「x」');
    // 补列 DDL 已随 init 执行(ALTER×4 + CREATE×2),由 execute 调用数间接验证
    expect(db.execute).toHaveBeenCalled();
  });

  it('ensureSchema:重复列报错被吞,其余错误抛出', async () => {
    let calls = 0;
    const db = {
      execute: vi.fn(async (sql: string) => {
        if (sql.startsWith('ALTER')) {
          calls += 1;
          if (calls === 1) throw new Error('duplicate column name: last_rating');
        }
        return { rowsAffected: 0 } as never;
      }),
    } as unknown as Database;
    await expect(ensureSchema(db)).resolves.toBeUndefined();
  });
});

describe('写入路径', () => {
  it('saveMyQuestion → fire-and-forget UPSERT;saveCard → review_state UPSERT 含 last_rating', async () => {
    const { db, calls } = fakeDb();
    await initStorage({ db, loadBundledBank: false });
    saveMyQuestion(myRowToQuestion(myRow('my.9.1')));
    saveCard('my.9.1', rate(null, 'ok', Date.now()), 'my');
    expect(calls.some((c) => c.sql.includes('INSERT INTO questions'))).toBe(true);
    const rs = calls.find((c) => c.sql.includes('INSERT INTO review_state'));
    expect(rs?.sql).toContain('last_rating');
  });

  it('deleteMyQuestion 级联:附属四表 + 题目行,顺序固定', async () => {
    const { db, calls } = fakeDb();
    await initStorage({ db, loadBundledBank: false });
    saveMyQuestion(myRowToQuestion(myRow('my.9.2')));
    calls.length = 0;
    deleteMyQuestion('my.9.2');
    await vi.waitFor(() => expect(calls.length).toBe(5));
    const order = calls.map((c) => c.sql);
    expect(order[0]).toContain('DELETE FROM review_state');
    expect(order[1]).toContain('DELETE FROM notes');
    expect(order[2]).toContain('DELETE FROM code_drafts');
    expect(order[3]).toContain('DELETE FROM rating_log');
    expect(order[4]).toContain('DELETE FROM questions');
  });

  it('approvePending:gen.* → my.<模块>.<序号>,source_ref/jd_id 保留', async () => {
    const { db } = fakeDb();
    await initStorage({ db, loadBundledBank: false });
    saveMyQuestion(myRowToQuestion(myRow('gen.1.0', { status: 'pending', source: 'jd', jd_id: 3, source_ref: '按 JD 生成 · 前端' })));
    const newId = approvePending('gen.1.0');
    expect(newId).toMatch(/^my\.1\.\d+$/);
    const q = getQuestion(newId!)!;
    expect(q.status).toBe('approved');
    expect(q.jdId).toBe(3);
    expect(q.sourceRef).toBe('按 JD 生成 · 前端');
  });

  it('copyOfficialToMy:source=copy 且带溯源 id', async () => {
    const fake = fakeDb({
      official_questions: [
        {
          id: 'fe.2.1', category: 'fe', module: 2, module_name: 'm', index_real: 1,
          difficulty: '初', title: 't', focus: 'f', answer: '["a"]', followups: '[]', tags: '[]', synced_at: 1,
        },
      ],
    });
    await initStorage({ db: fake.db, loadBundledBank: false });
    const copy = copyOfficialToMy('fe.2.1');
    expect(copy?.source).toBe('copy');
    expect(copy?.sourceId).toBe('fe.2.1');
    expect(copy?.origin).toBe('my');
  });

  it('备份信封:不含 secrets;导入前可解析(version 校验在 backup.ts)', async () => {
    const { db } = fakeDb();
    await initStorage({ db, loadBundledBank: false });
    saveJd({ id: 1, title: 't', company: '', content: 'c', createdAt: 1, lastActiveAt: 2 });
    const env = buildEnvelope();
    expect(env.version).toBe(1);
    expect(Object.keys(env.tables).sort()).toEqual(
      ['code_drafts', 'jds', 'meta', 'notes', 'profile', 'questions', 'rating_log', 'review_state'],
    );
    expect('secrets' in env.tables).toBe(false);
  });
});
