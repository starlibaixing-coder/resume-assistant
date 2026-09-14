// 响应式 hooks:storage pub-sub → useSyncExternalStore(不引入状态库,§2 硬约束)。
// 以全局版本号为稳定快照键,派生数据按版本 memo。

import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { countStatus, type StatusCounts } from './bank';
import { getSessionSnapshot, subscribeSession, type SessionSnapshot } from './session';
import {
  activityDays,
  getAllQuestions,
  getCodeDraft,
  getJds,
  getMeta,
  getMyQuestions,
  getNote,
  getOfficialQuestions,
  getProfile,
  getResumes,
  getReviewStates,
  getSecret,
  getVersion,
  subscribe,
  type StorageKey,
} from './storage';
import { getTheme, subscribeTheme, type Theme } from './theme';
import type { ActivityDay, Jd, Profile, Question, Resume } from './types';

function useVersion(): number {
  return useSyncExternalStore((fn) => subscribe('*', fn), getVersion, () => 0);
}

function useKeyVersion(key: StorageKey): number {
  const v = useSyncExternalStore(
    useCallback((fn: () => void) => subscribe(key, fn), [key]),
    getVersion,
    () => 0,
  );
  return v;
}

export function useQuestions(): Question[] {
  const v = useVersion();
  return useMemo(() => getAllQuestions(), [v]);
}

export function useMyQuestions(): Question[] {
  useKeyVersion('my');
  const v = useVersion();
  return useMemo(() => getMyQuestions(), [v]);
}

export function useOfficialQuestions(): Question[] {
  useKeyVersion('official');
  const v = useVersion();
  return useMemo(() => getOfficialQuestions(), [v]);
}

let countsCache: { v: number; counts: StatusCounts } | null = null;

/** 五档计数(deriveStatus 唯一出口;状态栏/今日页/徽标共用) */
export function useStatusCounts(): StatusCounts {
  const v = useVersion();
  return useMemo(() => {
    if (countsCache?.v === v) return countsCache.counts;
    const counts = countStatus(getAllQuestions(), getReviewStates(), Date.now());
    countsCache = { v, counts };
    return counts;
  }, [v]);
}

let jdsCache: { v: number; j: Jd[] } | null = null;

export function useJdList(): Jd[] {
  useKeyVersion('jds');
  const v = useVersion();
  return useMemo(() => {
    if (jdsCache?.v !== v) jdsCache = { v, j: getJds() };
    return jdsCache.j;
  }, [v]);
}

export function useProfile(): Profile {
  useKeyVersion('profile');
  return useSyncExternalStore(
    useCallback((fn: () => void) => subscribe('profile', fn), []),
    getProfile,
    getProfile,
  );
}

let resumesCache: { v: number; r: Resume[] } | null = null;

export function useResumes(): Resume[] {
  useKeyVersion('resumes');
  const v = useVersion();
  return useMemo(() => {
    if (resumesCache?.v !== v) resumesCache = { v, r: getResumes() };
    return resumesCache.r;
  }, [v]);
}

export function useMeta(key: string): string {
  useKeyVersion('meta');
  return useSyncExternalStore(
    useCallback((fn: () => void) => subscribe('meta', fn), [key]),
    () => getMeta(key),
    () => '',
  );
}

export function useSecret(name: string): string {
  useKeyVersion('secrets');
  return useSyncExternalStore(
    useCallback((fn: () => void) => subscribe('secrets', fn), [name]),
    () => getSecret(name),
    () => '',
  );
}

export function useNote(id: string): string {
  useKeyVersion('notes');
  return useSyncExternalStore(
    useCallback((fn: () => void) => subscribe('notes', fn), [id]),
    () => getNote(id),
    () => '',
  );
}

export function useDraft(id: string): string {
  useKeyVersion('drafts');
  return useSyncExternalStore(
    useCallback((fn: () => void) => subscribe('drafts', fn), [id]),
    () => getCodeDraft(id),
    () => '',
  );
}

let activityCache: { v: number; a: ActivityDay[] } | null = null;

export function useActivityList(): ActivityDay[] {
  useKeyVersion('activity');
  const v = useVersion();
  return useMemo(() => {
    if (activityCache?.v !== v) activityCache = { v, a: activityDays() };
    return activityCache.a;
  }, [v]);
}

export function useSession(): SessionSnapshot | null {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
}

export function useThemeValue(): Theme {
  return useSyncExternalStore(subscribeTheme, getTheme, () => 'light');
}

export function useReady(ready: boolean): boolean {
  return ready;
}
