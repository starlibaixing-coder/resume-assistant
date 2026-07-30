import { useEffect, useState } from 'react';

// 加载 questions.json，缓存到模块级
let cache = null;

export function useQuestions() {
  const [data, setData] = useState(cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cache) return;
    fetch(import.meta.env.BASE_URL + 'questions.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        cache = d;
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  return { data, error };
}
