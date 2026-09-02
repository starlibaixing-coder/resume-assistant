import { useEffect, useState } from 'react';
import type { MyQuestion, QuestionData } from '@/types/question';
import { getMyCategory, getMyQuestions, subscribeMyLib } from './mylib';
import { ensureOfficial, getOfficial, subscribeOfficial } from './officialbank';

// 聚合层:官方题(officialbank,DB 物化,可同步)+ 我的库 approved 题(ADR-3 双库)
// pending 不进刷题(ADR-10:approve 后才进 SM-2 队列)

// 聚合纯函数:official + approved 我的题。无 approved 我的题时原样返回(首页单独渲染入口卡片)。
export function mergeQuestionData(official: QuestionData, myQuestions: MyQuestion[]): QuestionData {
  const approved = myQuestions.filter((q) => q.status === 'approved');
  if (!approved.length) return official;
  const myCategory = getMyCategory();
  return {
    categories: [...official.categories, myCategory],
    questions: [
      ...official.questions,
      ...approved.map(({ status: _status, createdAt: _createdAt, updatedAt: _updatedAt, sourceId: _sourceId, source: _source, ...q }) => q),
    ],
    total: official.total + approved.length,
  };
}

export function useQuestions(): { data: QuestionData | null; error: string | null; retry: () => void } {
  const [data, setData] = useState<QuestionData | null>(() =>
    getOfficial() ? mergeQuestionData(getOfficial()!, getMyQuestions()) : null,
  );
  const [error, setError] = useState<string | null>(null);
  // attempt 变化触发 effect 重跑(ensureOfficial 失败后的页面级重试)
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const recompute = () => {
      const official = getOfficial();
      if (alive && official) setData(mergeQuestionData(official, getMyQuestions()));
    };
    // 官方题就绪(DB 加载/播种/远端同步)+ 我的库变化(approve/编辑/删除)都重算聚合
    ensureOfficial()
      .then(recompute)
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    const un1 = subscribeOfficial(recompute);
    const un2 = subscribeMyLib(recompute);
    return () => {
      alive = false;
      un1();
      un2();
    };
  }, [attempt]);

  return { data, error, retry: () => { setError(null); setAttempt((a) => a + 1); } };
}
