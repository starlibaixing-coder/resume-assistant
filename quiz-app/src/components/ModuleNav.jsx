import { useMemo, useState } from 'react';
import { useQuestions } from '../lib/useQuestions.js';
import { getModuleStats, getQuestionStatus } from '../lib/schedule.js';
import AnswerPanel from './AnswerPanel.jsx';
import NotePanel from './NotePanel.jsx';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unmastered', label: '未掌握' },
  { key: 'due', label: '待复习' },
  { key: 'high', label: '高难度' },
];

export default function ModuleNav({ category }) {
  const { data, error } = useQuestions();
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');

  const { cat, byModule, moduleStats } = useMemo(() => {
    if (!data) return { cat: null, byModule: {}, moduleStats: {} };
    const cat = data.categories.find((c) => c.slug === category);
    const catQuestions = data.questions.filter((q) => q.category === category);
    const byModule = {};
    for (const q of catQuestions) {
      if (!byModule[q.module]) byModule[q.module] = [];
      byModule[q.module].push(q);
    }
    for (const m of Object.keys(byModule)) {
      byModule[m].sort((a, b) => a.index - b.index);
    }
    return {
      cat,
      byModule,
      moduleStats: getModuleStats(category, catQuestions),
    };
  }, [data, category]);

  if (error) return <div className="empty-hint">加载失败: {error}</div>;
  if (!data || !cat) return <div className="empty-hint">加载中…</div>;

  // URL ?m=N 决定展开哪个模块，默认全部展开
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const focusMod = params.get('m');

  // 题目筛选
  const filterQuestion = (q) => {
    if (filter === 'all') return true;
    const status = getQuestionStatus(category, q.id);
    if (filter === 'unmastered') return status !== 'mastered';
    if (filter === 'due') return status === 'due' || status === 'unseen';
    if (filter === 'high') return q.difficulty === '高';
    return true;
  };

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

      {/* 筛选条 */}
      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-btn${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cat.modules.map((mod) => {
        const qs = (byModule[mod.id] || []).filter(filterQuestion);
        const collapsed = focusMod && focusMod !== String(mod.id);
        const stats = moduleStats[mod.id];
        const learnedPct = stats && stats.total
          ? Math.round((stats.learned / stats.total) * 100)
          : 0;
        return (
          <div
            key={mod.id}
            style={{ marginBottom: 20, display: collapsed ? 'none' : 'block' }}
          >
            <div className="mod-head">
              <div className="section-title" style={{ marginBottom: 0 }}>
                {String(mod.id).padStart(2, '0')} · {mod.name}（{qs.length}/{stats?.total || 0}）
              </div>
              {stats && (
                <div className="mod-stats">
                  <span className="ms-item">已学 {stats.learned}/{stats.total}</span>
                  {stats.mastered > 0 && (
                    <span className="ms-item ms-good">掌握 {stats.mastered}</span>
                  )}
                  {stats.dueToday > 0 && (
                    <span className="ms-item ms-warn">待复习 {stats.dueToday}</span>
                  )}
                </div>
              )}
            </div>
            {stats && stats.total > 0 && (
              <div className="mini-progress">
                <div style={{ width: `${learnedPct}%` }} />
              </div>
            )}

            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                marginTop: 8,
              }}
            >
              {qs.length === 0 ? (
                <div className="empty-hint" style={{ padding: 16 }}>
                  本筛选下无题
                </div>
              ) : (
                qs.map((q) => {
                  const isOpen = expandedId === q.id;
                  return (
                    <div key={q.id} className={`q-list-item${isOpen ? ' expanded' : ''}`}>
                      <div
                        className="q-list-head"
                        onClick={() => setExpandedId(isOpen ? null : q.id)}
                      >
                        <span className="qid">
                          {isOpen ? '▼' : '▶'} Q{q.id.split('.').slice(1).join('.')}
                        </span>
                        <span className="qtitle">{q.title}</span>
                        <span
                          className={`tag diff-${q.difficulty}`}
                          style={{ marginLeft: 'auto', flexShrink: 0 }}
                        >
                          {q.difficulty}
                        </span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '0 14px 16px' }}>
                          <div className="q-focus" style={{ margin: '8px 0 12px' }}>
                            {q.focus}
                          </div>
                          <AnswerPanel answer={q.answer} followups={q.followups} />
                          <NotePanel category={category} questionId={q.id} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
