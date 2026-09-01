// JD 库(求职中枢一期)—— 增删改/置顶排序/normalize/订阅/persist 契约
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from '@tauri-apps/plugin-sql';
import {
  getJds,
  getJd,
  addJd,
  updateJd,
  deleteJd,
  subscribeJds,
  _resetJdsForTest,
  _setJdsDbForTest,
} from './jd';

function mockDb(lastInsertId = 0) {
  return {
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId }),
    select: vi.fn().mockResolvedValue([]),
  } as unknown as Database;
}

beforeEach(() => _resetJdsForTest());

describe('jd 库', () => {
  it('初始为空', () => {
    expect(getJds()).toEqual([]);
    expect(getJd(1)).toBeNull();
  });

  it('addJd:标题缺省回退公司 → JD 前 12 字;写入后可读回', async () => {
    const a = await addJd({ title: '', company: '示例公司', content: '负责 RAG 系统…' });
    expect(a.title).toBe('示例公司');
    const b = await addJd({ title: '', company: '', content: '负责向量数据库调优与召回优化' });
    expect(b.title).toBe('负责向量数据库调优与召回优'.slice(0, 12));
    expect(getJds()).toHaveLength(2);
  });

  it('addJd 后 notify 订阅者', async () => {
    const fn = vi.fn();
    const unsub = subscribeJds(fn);
    await addJd({ title: 't', company: '', content: 'c' });
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('updateJd 更新内容并置顶', async () => {
    const a = await addJd({ title: 'A', company: '', content: 'a' });
    await addJd({ title: 'B', company: '', content: 'b' });
    await updateJd(a.id, { title: 'A2', company: 'c2', content: 'a2' });
    expect(getJds()[0].title).toBe('A2');
    expect(getJd(a.id)?.content).toBe('a2');
  });

  it('updateJd 不存在的 id 抛错', async () => {
    await expect(updateJd(99, { title: '', company: '', content: 'x' })).rejects.toThrow(/不存在/);
  });

  it('deleteJd 删除', async () => {
    const a = await addJd({ title: 'A', company: '', content: 'a' });
    await deleteJd(a.id);
    expect(getJd(a.id)).toBeNull();
  });

  it('persist 走 INSERT(真库自增 id 回填)', async () => {
    const db = mockDb(7);
    _setJdsDbForTest(db);
    const a = await addJd({ title: 't', company: 'c', content: 'x' });
    expect(a.id).toBe(7);
    const [sql, params] = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO jds');
    expect(params.slice(0, 3)).toEqual(['t', 'c', 'x']);
  });

  it('persist 失败不阻塞(缓存仍更新)', async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error('db down')),
      select: vi.fn(),
    } as unknown as Database;
    _setJdsDbForTest(db);
    const a = await addJd({ title: 't', company: '', content: 'c' });
    expect(getJd(a.id)?.title).toBe('t');
  });
});
