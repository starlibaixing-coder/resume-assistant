import { useEffect, useState } from 'react';
import type { MyQuestion, QuestionData } from '@/types/question';
import { getMyCategory, getMyQuestions, subscribeMyLib } from './mylib';

// 加载官方 questions.json(模块级缓存),聚合我的库 approved 题(ADR-3 双库)
// pending 不进刷题(ADR-10:approve 后才进 SM-2 队列)

let officialCache: QuestionData | null = null;

// 聚合纯函数:official + approved 我的题。无 approved 我的题时原样返回(首页单独渲染入口卡片)。
export function mergeQuestionData(official: QuestionData, myQuestions: MyQuestion[]): QuestionData {
  const approved = myQuestions.filter((q) => q.status === 'approved');
  if (!approved.length) return official;
  const myCategory = getMyCategory();
  return {
    categories: [...official.categories, myCategory],
    questions: [
      ...official.questions,
      ...approved.map(({ status: _status, createdAt: _createdAt, updatedAt: _updatedAt, ...q }) => q),
    ],
    total: official.total + approved.length,
  };
}

export function useQuestions(): { data: QuestionData | null; error: string | null } {
  const [data, setData] = useState<QuestionData | null>(() =>
    officialCache ? mergeQuestionData(officialCache, getMyQuestions()) : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!officialCache) {
      fetch(import.meta.env.BASE_URL + 'questions.json')
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d: QuestionData) => {
          officialCache = d;
          setData(mergeQuestionData(d, getMyQuestions()));
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    }
    // 我的库变化(approve/编辑/删除/SQLite 灌入后)重算聚合
    return subscribeMyLib(() => {
      if (officialCache) setData(mergeQuestionData(officialCache, getMyQuestions()));
    });
  }, []);

  return { data, error };
}
