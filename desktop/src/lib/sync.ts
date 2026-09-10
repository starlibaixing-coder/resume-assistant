// 官方题库同步(§5.3):YAML(仓库)是唯一真相源,远端 questions.json 是部署形态,
// 本地 official_* 表是投影。新增 upsert、缺失级联删除(ADR-9 id 作废不复用)。
// 首次启动播种包内 questions.json;三态反馈:已是最新 / 更新 N(新增 a 下架 d)/ 失败可重试。

import { logger } from './logger';
import {
  applyOfficialCache,
  deleteOfficialQuestion,
  getMeta,
  getOfficialQuestions,
  resetReviewCachesForSync,
  setMeta,
  upsertOfficialQuestions,
  type CategoryMeta,
} from './storage';
import type { Difficulty, Question } from './types';

export const OFFICIAL_REMOTE_URL =
  'https://starlibaixing-coder.github.io/resume-assistant/questions.json';

interface RemoteBank {
  categories: { slug: string; name: string; description: string }[];
  questions: Record<string, unknown>[];
}

export type SyncResult =
  | { status: 'same' }
  | { status: 'updated'; added: number; removed: number; updated: number }
  | { status: 'error'; message: string };

export async function fetchRemote(url = OFFICIAL_REMOTE_URL): Promise<RemoteBank> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`远端返回 ${res.status}`);
  return (await res.json()) as RemoteBank;
}

function remoteToQuestion(q: Record<string, unknown>, slug: string): Question {
  return {
    id: String(q.id),
    origin: 'official',
    category: slug,
    module: Number(q.module),
    moduleName: String(q.moduleName),
    index: Number(q.index),
    difficulty: q.difficulty as Difficulty,
    title: String(q.title),
    focus: String(q.focus ?? ''),
    answer: (q.answer as string[]) ?? [],
    followups: (q.followups as string[]) ?? [],
    tags: (q.tags as string[]) ?? [],
    status: 'approved',
    source: 'official',
    sourceId: null,
    sourceRef: '',
    jdId: null,
    isCode: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** 拉取远端并对齐本地。返回 null 表示无差异。 */
export async function syncOfficial(fetchFn: typeof fetchRemote = fetchRemote): Promise<SyncResult> {
  let remote: RemoteBank;
  try {
    remote = await fetchFn();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn(`[sync] 拉取远端失败: ${message}`);
    return { status: 'error', message };
  }
  const local = new Map(getOfficialQuestions().map((q) => [q.id, q]));
  const remoteIds = new Set(remote.questions.map((q) => String(q.id)));

  const added = remote.questions.filter((q) => !local.has(String(q.id)));
  const removed = [...local.keys()].filter((id) => !remoteIds.has(id));
  const kept = remote.questions.filter((q) => local.has(String(q.id)));

  for (const id of removed) await deleteOfficialQuestion(id);
  for (const cat of remote.categories) {
    const rows = remote.questions
      .filter((q) => String(q.category) === cat.slug)
      .map((q) => toRow(q, cat.slug));
    await upsertOfficialQuestions(rows, cat.slug, cat.name, cat.description);
  }

  const categories: CategoryMeta[] = remote.categories.map((c) => ({ slug: c.slug, name: c.name, description: c.description }));
  applyOfficialCache(
    remote.questions.map((q) => remoteToQuestion(q, String(q.category))),
    categories,
  );
  resetReviewCachesForSync(removed);
  setMeta('last_sync_at', String(Date.now()));

  if (added.length === 0 && removed.length === 0 && kept.length === local.size) return { status: 'same' };
  logger.info(`[sync] 官方库同步:新增 ${added.length} / 下架 ${removed.length} / 覆盖 ${kept.length}`);
  return { status: 'updated', added: added.length, removed: removed.length, updated: kept.length };
}

function toRow(q: Record<string, unknown>, slug: string) {
  return {
    id: String(q.id),
    category: slug,
    module: Number(q.module),
    module_name: String(q.moduleName),
    index_real: Number(q.index),
    difficulty: q.difficulty as Difficulty,
    title: String(q.title),
    focus: String(q.focus ?? ''),
    answer: JSON.stringify(q.answer ?? []),
    followups: JSON.stringify(q.followups ?? []),
    tags: JSON.stringify(q.tags ?? []),
    synced_at: Date.now(),
  };
}

/** 首次启动播种(official_questions 为空时,用包内 questions.json) */
export async function seedOfficialIfEmpty(): Promise<boolean> {
  if (getOfficialQuestions().length > 0) return false;
  try {
    const res = await fetch('/questions.json');
    const bank = (await res.json()) as RemoteBank;
    for (const cat of bank.categories) {
      const rows = bank.questions.filter((q) => String(q.category) === cat.slug).map((q) => toRow(q, cat.slug));
      await upsertOfficialQuestions(rows, cat.slug, cat.name, cat.description);
    }
    applyOfficialCache(
      bank.questions.map((q) => remoteToQuestion(q, String(q.category))),
      bank.categories.map((c) => ({ slug: c.slug, name: c.name, description: c.description })),
    );
    setMeta('last_sync_at', String(Date.now()));
    logger.info(`[sync] 首次播种官方题库 ${bank.questions.length} 题`);
    return true;
  } catch (e) {
    logger.error(`[sync] 播种失败: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export function lastSyncAt(): number | null {
  const v = getMeta('last_sync_at');
  return v ? Number(v) : null;
}
