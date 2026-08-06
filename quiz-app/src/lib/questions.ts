import { useEffect, useState } from 'react';
import type { QuestionData } from '@/types/question';

// 加载 questions.json，缓存到模块级
let cache: QuestionData | null = null;

export function useQuestions(): { data: QuestionData | null; error: string | null } {
  const [data, setData] = useState<QuestionData | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    fetch(import.meta.env.BASE_URL + 'questions.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: QuestionData) => {
        cache = d;
        setData(d);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return { data, error };
}
