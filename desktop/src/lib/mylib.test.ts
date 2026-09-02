// 我的库数据层 —— 缓存逻辑 + id 分配 + CRUD persist 契约 + 级联清理
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from '@tauri-apps/plugin-sql';
import {
  addDrafts,
  addManualQuestion,
  allocateIds,
  approveQuestion,
  copyOfficial,
  deleteQuestion,
  getMyCategory,
  getMyQuestion,
  getMyQuestions,
  getCopiedSourceIds,
  getPendingCount,
  nextModuleId,
  rejectDraft,
  subscribeMyLib,
  updateQuestion,
  rowToMyQuestion,
  MY_CATEGORY_SLUG,
  type DraftQuestion,
  type MyQuestionRow,
  _resetMyLibForTest,
  _setMyLibDbForTest,
} from './mylib';
import type { Question } from '@/types/question';

function draft(partial: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    difficulty: '中',
    title: '什么是 React Server Components?',
    focus: '理解 RSC 的渲染模型',
    answer: [
      'RSC 是在服务端执行的组件,渲染产物是序列化的 UI 描述流',
      '客户端组件负责交互和水合,服务端组件不打进客户端 bundle',
      '数据获取可以就地 await,不用 useEffect 加载态',
    ],
    followups: ['RSC 和 SSR 的区别是什么?'],
    tags: ['react'],
    ...partial,
  };
}

function official(partial: Partial<Question> = {}): Question {
  return {
    id: 'fe.01.1',
    category: 'fe',
    module: 1,
    moduleName: 'JavaScript 基础',
    index: 1,
    type: 'qa',
    difficulty: '初',
    tags: ['js'],
    title: '什么是闭包?',
    focus: '闭包的概念',
    answer: ['闭包是函数与其词法环境的组合'],
    followups: [],
    ...partial,
  };
}

function mockDb() {
  return { execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }), select: vi.fn().mockResolvedValue([]) } as unknown as Database;
}

beforeEach(() => _resetMyLibForTest());

// ===== 纯函数 =====

describe('nextModuleId', () => {
  it('空库返回 1(模块 0 留给官方副本)', () => {
    expect(nextModuleId([])).toBe(1);
  });

  it('现有最大模块号 + 1(跳过模块 0)', () => {
    const qs = [{ module: 2 }, { module: 0 }] as never[];
    expect(nextModuleId(qs)).toBe(3);
  });
});

describe('allocateIds', () => {
  it('顺序分配 my.<module>.<idx>', () => {
    expect(allocateIds([], 1, 3)).toEqual(['my.1.1', 'my.1.2', 'my.1.3']);
  });

  it('同模块已有 id 时从最大题号顺延', () => {
    expect(allocateIds(['my.1.1', 'my.1.3'], 1, 2)).toEqual(['my.1.4', 'my.1.5']);
  });

  it('其他模块的 id 不影响本模块题号', () => {
    expect(allocateIds(['my.2.9'], 1, 1)).toEqual(['my.1.1']);
  });

  it('分配的 id 与已有集合不冲突(跳号)', () => {
    expect(allocateIds(['my.0.1'], 0, 2)).toEqual(['my.0.2', 'my.0.3']);
  });
});

describe('rowToMyQuestion', () => {
  it('SQLite 行映射(含 JSON 数组解析)', () => {
    const row: MyQuestionRow = {
      id: 'my.1.1', category: 'my', module: 1, module_name: 'React', index_real: 1.5,
      difficulty: '中', title: 't', focus: 'f',
      answer: '["a"]', followups: '["q"]', tags: '["x"]',
      status: 'pending', source_id: null, source: 'ai', created_at: 1, updated_at: 2,
    };
    const q = rowToMyQuestion(row);
    expect(q.index).toBe(1.5);
    expect(q.answer).toEqual(['a']);
    expect(q.status).toBe('pending');
    expect(q.type).toBe('qa');
    expect(q.source).toBe('ai');
  });

  it('difficulty 非法时降级为中(脏数据容错)', () => {
    const row = { difficulty: 'expert' } as MyQuestionRow;
    expect(rowToMyQuestion(row).difficulty).toBe('中');
  });

  it('source 非法时降级为 manual(脏数据容错)', () => {
    const row = { source: 'weird' } as unknown as MyQuestionRow;
    expect(rowToMyQuestion(row).source).toBe('manual');
  });

  it('JSON 解析失败返回空数组(脏数据容错)', () => {
    const row = { answer: 'not-json', followups: 'x', tags: '3' } as unknown as MyQuestionRow;
    const q = rowToMyQuestion(row);
    expect(q.answer).toEqual([]);
    expect(q.followups).toEqual([]);
    expect(q.tags).toEqual([]);
  });
});

// ===== 缓存 + CRUD =====

describe('addDrafts', () => {
  it('进草稿区:pending 状态 + 新模块 + id 分配', async () => {
    const created = await addDrafts([draft(), draft({ title: '第二题?' })], 'React Hooks');
    expect(created.map((q) => q.id)).toEqual(['my.1.1', 'my.1.2']);
    expect(created.every((q) => q.status === 'pending')).toBe(true);
    expect(created[0].moduleName).toBe('React Hooks');
    expect(created[0].category).toBe(MY_CATEGORY_SLUG);
    expect(created.every((q) => q.source === 'ai')).toBe(true);
    expect(getPendingCount()).toBe(2);
  });

  it('来源标注:jd 生成批次 source=jd', async () => {
    const created = await addDrafts([draft()], 'JD定向 · 示例公司', 'jd');
    expect(created[0].source).toBe('jd');
  });

  it('模块名截断 30 字', async () => {
    const created = await addDrafts([draft()], 'x'.repeat(50));
    expect(created[0].moduleName.length).toBe(30);
  });

  it('第二批进新模块', async () => {
    await addDrafts([draft()], 'A');
    const b = await addDrafts([draft()], 'B');
    expect(b[0].module).toBe(2);
    expect(b[0].id).toBe('my.2.1');
  });

  it('不合法草稿抛错不入库', async () => {
    await expect(addDrafts([draft({ answer: ['太短'] })], 'X')).rejects.toThrow('答案过短');
    expect(getMyQuestions()).toEqual([]);
  });

  it('persist:INSERT questions(参数含 JSON 数组)', async () => {
    const db = mockDb();
    _setMyLibDbForTest(db);
    await addDrafts([draft()], 'React');
    const sql = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO questions');
    const args = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][1] as unknown[];
    expect(args[0]).toBe('my.1.1');
    expect(JSON.parse(args[8] as string)).toEqual(draft().answer); // answer JSON
    expect(args[11]).toBe('pending'); // status
  });

  it('db 未就绪时静默(不抛错,缓存仍生效)', async () => {
    await expect(addDrafts([draft()], 'React')).resolves.toBeTruthy();
    expect(getMyQuestions().length).toBe(1);
  });
});

describe('approve / reject(ADR-10 草稿区)', () => {
  it('approve 后进 getMyCategory(聚合可见)', async () => {
    const [q] = await addDrafts([draft()], 'React');
    await approveQuestion(q.id);
    expect(getMyQuestion(q.id)?.status).toBe('approved');
    const cat = getMyCategory();
    expect(cat.count).toBe(1);
    expect(cat.modules).toEqual([{ id: 1, name: 'React', count: 1 }]);
  });

  it('pending 不进 getMyCategory', async () => {
    await addDrafts([draft()], 'React');
    expect(getMyCategory().count).toBe(0);
    expect(getMyCategory().modules).toEqual([]);
  });

  it('approve 幂等(已 approved 不再写库)', async () => {
    const db = mockDb();
    _setMyLibDbForTest(db);
    const [q] = await addDrafts([draft()], 'React');
    (db.execute as ReturnType<typeof vi.fn>).mockClear();
    await approveQuestion(q.id);
    await approveQuestion(q.id);
    expect((db.execute as ReturnType<typeof vi.fn>).mock.calls.filter((c) => String(c[0]).includes('UPDATE'))).toHaveLength(1);
  });

  it('reject 删除草稿', async () => {
    const [q] = await addDrafts([draft()], 'React');
    await rejectDraft(q.id);
    expect(getMyQuestion(q.id)).toBeNull();
    expect(getPendingCount()).toBe(0);
  });

  it('reject 对 approved 无效', async () => {
    const [q] = await addDrafts([draft()], 'React');
    await approveQuestion(q.id);
    await rejectDraft(q.id);
    expect(getMyQuestion(q.id)?.status).toBe('approved');
  });
});

describe('copyOfficial(ADR-3 复制后改)', () => {
  it('副本进模块 0,approved,id 顺延', async () => {
    const copy = await copyOfficial(official());
    expect(copy.id).toBe('my.0.1');
    expect(copy.module).toBe(0);
    expect(copy.status).toBe('approved');
    expect(copy.title).toBe('什么是闭包?');
    expect(getMyCategory().modules[0].name).toBe('官方题副本');
  });

  it('多副本题号顺延', async () => {
    await copyOfficial(official());
    const c2 = await copyOfficial(official({ id: 'fe.01.2' }));
    expect(c2.id).toBe('my.0.2');
  });

  it('记录来源官方题 id,persist 含 source_id', async () => {
    const db = mockDb();
    _setMyLibDbForTest(db);
    const copy = await copyOfficial(official());
    expect(copy.sourceId).toBe('fe.01.1');
    expect(getCopiedSourceIds().has('fe.01.1')).toBe(true);
    const [sql, params] = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('source_id');
    expect(params).toContain('fe.01.1');
  });

  it('删副本后溯源标识消失', async () => {
    const copy = await copyOfficial(official());
    expect(getCopiedSourceIds().has('fe.01.1')).toBe(true);
    await deleteQuestion(copy.id);
    expect(getCopiedSourceIds().has('fe.01.1')).toBe(false);
  });

  it('rowToMyQuestion 映射 source_id(null 安全)', () => {
    const row = {
      id: 'my.0.1', category: 'my', module: 0, module_name: '官方题副本', index_real: 1,
      difficulty: '初', title: 't', focus: '', answer: '[]', followups: '[]', tags: '[]',
      status: 'approved', source_id: 'fe.01.1', created_at: 0, updated_at: 0,
    } as MyQuestionRow;
    expect(rowToMyQuestion(row).sourceId).toBe('fe.01.1');
    const legacy = { ...row, source_id: null };
    expect(rowToMyQuestion(legacy).sourceId).toBeNull();
  });
});

describe('addManualQuestion(手动加题,直接 approved)', () => {
  it('新模块:approved + id 分配 + 无溯源', async () => {
    const q = await addManualQuestion(draft(), { moduleName: '面试手写' });
    expect(q.id).toBe('my.1.1');
    expect(q.module).toBe(1);
    expect(q.moduleName).toBe('面试手写');
    expect(q.status).toBe('approved');
    expect(q.sourceId).toBeNull();
    // 直接进聚合分类(不进草稿区)
    expect(getMyCategory().count).toBe(1);
    expect(getPendingCount()).toBe(0);
  });

  it('指定既有模块:进该模块且题号顺延', async () => {
    const first = await addManualQuestion(draft(), { moduleName: '面试手写' });
    const second = await addManualQuestion(draft({ title: '第二题?' }), {
      moduleId: first.module,
      moduleName: first.moduleName,
    });
    expect(second.id).toBe('my.1.2');
    expect(second.module).toBe(1);
    expect(getMyCategory().modules).toHaveLength(1);
  });

  it('校验失败拒绝入库(共享硬规则)', async () => {
    await expect(
      addManualQuestion(draft({ answer: ['太短'] }), { moduleName: 'x' }),
    ).rejects.toThrow(/过短/);
    expect(getMyQuestions()).toHaveLength(0);
  });

  it('persist 走 INSERT questions(status=approved)', async () => {
    const db = mockDb();
    _setMyLibDbForTest(db);
    await addManualQuestion(draft(), { moduleName: '面试手写' });
    const [sql, params] = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO questions');
    expect(params).toContain('approved');
  });
});

describe('updateQuestion', () => {
  it('改后可读 + persist UPDATE', async () => {
    const db = mockDb();
    _setMyLibDbForTest(db);
    const [q] = await addDrafts([draft()], 'React');
    (db.execute as ReturnType<typeof vi.fn>).mockClear();
    const updated = await updateQuestion(q.id, { title: '新题干?' });
    expect(updated.title).toBe('新题干?');
    const sql = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(sql).toContain('UPDATE questions');
    expect(getMyQuestion(q.id)?.title).toBe('新题干?');
  });

  it('改成不合法内容抛错,原值保留', async () => {
    const [q] = await addDrafts([draft()], 'React');
    await expect(updateQuestion(q.id, { title: '' })).rejects.toThrow('缺 title');
    expect(getMyQuestion(q.id)?.title).toBe('什么是 React Server Components?');
  });
});

describe('deleteQuestion(级联清理)', () => {
  it('删题同时清 review_state / notes / code_drafts 孤儿', async () => {
    const db = mockDb();
    _setMyLibDbForTest(db);
    const [q] = await addDrafts([draft()], 'React');
    await approveQuestion(q.id);
    (db.execute as ReturnType<typeof vi.fn>).mockClear();
    await deleteQuestion(q.id);
    expect(getMyQuestion(q.id)).toBeNull();
    const sqls = (db.execute as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(sqls).toEqual([
      'DELETE FROM questions WHERE id=$1',
      'DELETE FROM review_state WHERE id=$1',
      'DELETE FROM notes WHERE id=$1',
      'DELETE FROM code_drafts WHERE id=$1',
    ]);
  });

  it('删不存在的题无副作用', async () => {
    await expect(deleteQuestion('nope')).resolves.toBeUndefined();
  });
});

describe('subscribeMyLib(pub-sub)', () => {
  it('mutate 后 notify,退订后不再收', async () => {
    const fn = vi.fn();
    const unsub = subscribeMyLib(fn);
    await addDrafts([draft()], 'React');
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    await addDrafts([draft()], 'Again');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
