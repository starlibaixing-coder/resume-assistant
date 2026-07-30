import { useMemo } from 'react';
import { useQuestions } from '../lib/useQuestions.js';

export default function ModuleNav({ category }) {
  const { data, error } = useQuestions();

  const { cat, byModule } = useMemo(() => {
    if (!data) return { cat: null, byModule: {} };
    const cat = data.categories.find((c) => c.slug === category);
    const byModule = {};
    for (const q of data.questions) {
      if (q.category !== category) continue;
      if (!byModule[q.module]) byModule[q.module] = [];
      byModule[q.module].push(q);
    }
    for (const m of Object.keys(byModule)) {
      byModule[m].sort((a, b) => a.index - b.index);
    }
    return { cat, byModule };
  }, [data, category]);

  if (error) return <div className="empty-hint">加载失败: {error}</div>;
  if (!data || !cat) return <div className="empty-hint">加载中…</div>;

  // URL ?m=N 决定展开哪个模块，默认全部展开
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const focusMod = params.get('m');

  return (
    <div>
      <a className="back-link" href={`#/${category}`}>
        ← 返回
      </a>
      <div className="app-header">
        <h1>
          <span className="accent">●</span> {cat.name} / 题目浏览
        </h1>
      </div>

      {cat.modules.map((mod) => {
        const qs = byModule[mod.id] || [];
        const collapsed = focusMod && focusMod !== String(mod.id);
        return (
          <div
            key={mod.id}
            style={{ marginBottom: 20, display: collapsed ? 'none' : 'block' }}
          >
            <div className="section-title">
              {String(mod.id).padStart(2, '0')} · {mod.name}（{qs.length}）
            </div>
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {qs.map((q) => (
                <div key={q.id} className="q-list-item">
                  <span className="qid">
                    Q{String(q.module).padStart(2, '0')}.{q.index}
                  </span>
                  <span className="qtitle">{q.title}</span>
                  <span
                    className={`tag diff-${q.difficulty}`}
                    style={{ marginLeft: 'auto', flexShrink: 0 }}
                  >
                    {q.difficulty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
