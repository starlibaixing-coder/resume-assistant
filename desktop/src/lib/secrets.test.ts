// 密钥数据层 —— 内存缓存 / UPSERT persist 契约 / 清空删除
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type Database from '@tauri-apps/plugin-sql';
import {
  getSecret,
  setSecret,
  loadSecretsFromDb,
  _resetSecretsForTest,
  _setSecretsDbForTest,
} from './secrets';

function mockDb() {
  return { execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }), select: vi.fn().mockResolvedValue([]) } as unknown as Database;
}

beforeEach(() => _resetSecretsForTest());

describe('secrets', () => {
  it('未存返回空串', async () => {
    expect(await getSecret('llm-api-key')).toBe('');
  });

  it('set 后可读回(内存)', async () => {
    await setSecret('llm-api-key', 'sk-1');
    expect(await getSecret('llm-api-key')).toBe('sk-1');
  });

  it('persist 走 UPSERT(name-value)', async () => {
    const db = mockDb();
    _setSecretsDbForTest(db);
    await setSecret('llm-api-key', 'sk-1');
    const [sql, params] = (db.execute as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ON CONFLICT(name) DO UPDATE');
    expect(params).toEqual(['llm-api-key', 'sk-1']);
  });

  it('空值删除而非落库', async () => {
    const db = mockDb();
    _setSecretsDbForTest(db);
    await setSecret('llm-api-key', 'sk-1');
    await setSecret('llm-api-key', '  ');
    expect(await getSecret('llm-api-key')).toBe('');
    const [sql] = (db.execute as ReturnType<typeof vi.fn>).mock.calls[1] as [string, unknown[]];
    expect(sql).toContain('DELETE FROM secrets');
  });

  it('loadSecretsFromDb 灌缓存', async () => {
    const db = mockDb();
    (db.select as ReturnType<typeof vi.fn>).mockResolvedValue([{ name: 'llm-api-key', value: 'sk-loaded' }]);
    _setSecretsDbForTest(db);
    await loadSecretsFromDb();
    expect(await getSecret('llm-api-key')).toBe('sk-loaded');
  });
});
