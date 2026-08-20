// 求职档案数据层 —— 缓存读写 / pub-sub / persist UPSERT 契约
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from '@tauri-apps/plugin-sql';
import {
  getProfile,
  saveProfile,
  subscribeProfile,
  loadProfileFromDb,
  _resetProfileForTest,
  _setProfileDbForTest,
} from './profile';

function mockDb() {
  return { execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }), select: vi.fn().mockResolvedValue([]) } as unknown as Database;
}

beforeEach(() => _resetProfileForTest());

describe('profile', () => {
  it('初始为 null(未录入)', () => {
    expect(getProfile()).toBeNull();
  });

  it('saveProfile 写缓存 + 可读回', async () => {
    const p = await saveProfile({ company: '示例公司', jd: '岗位描述…', resume: '# 简历' });
    expect(p.company).toBe('示例公司');
    expect(getProfile()?.jd).toBe('岗位描述…');
  });

  it('saveProfile 后 notify 订阅者', async () => {
    const fn = vi.fn();
    const unsub = subscribeProfile(fn);
    await saveProfile({ company: '', jd: 'jd', resume: '' });
    expect(fn).toHaveBeenCalledTimes(1);
    unsub();
    await saveProfile({ company: '', jd: 'jd2', resume: '' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('persist 走 UPSERT(id=1 单行)', async () => {
    const db = mockDb();
    _setProfileDbForTest(db);
    await saveProfile({ company: 'c', jd: 'j', resume: 'r' });
    const [sql, params] = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
    expect(params).toEqual(['c', 'j', 'r']);
  });

  it('persist 失败不阻塞(缓存仍更新)', async () => {
    const db = {
      execute: vi.fn().mockRejectedValue(new Error('db down')),
      select: vi.fn(),
    } as unknown as Database;
    _setProfileDbForTest(db);
    const p = await saveProfile({ company: 'c', jd: 'j', resume: '' });
    expect(p.jd).toBe('j');
    expect(getProfile()?.jd).toBe('j');
  });

  it('loadProfileFromDb 灌入已有行', async () => {
    const db = mockDb();
    (db.select as ReturnType<typeof vi.fn>).mockResolvedValue([
      { company: '示例公司', jd: 'jd 文本', resume: '简历文本' },
    ]);
    _setProfileDbForTest(db);
    await loadProfileFromDb();
    expect(getProfile()).toEqual({ company: '示例公司', jd: 'jd 文本', resume: '简历文本' });
  });

  it('loadProfileFromDb 无行保持 null', async () => {
    const db = mockDb();
    _setProfileDbForTest(db);
    await loadProfileFromDb();
    expect(getProfile()).toBeNull();
  });
});
