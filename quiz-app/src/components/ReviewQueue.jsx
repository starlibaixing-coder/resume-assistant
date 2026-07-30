import { useMemo } from 'react';
import { useQuestions } from '../lib/useQuestions.js';
import { getReviewQueue, getStats } from '../lib/schedule.js';

export default function ReviewQueue({ category }) {
  const { data, error } = useQuestions();

  const { ids, stats, queue } = useMemo(() => {
    if (!data) return { ids: [], stats: null, queue: null };
    const ids = data.questions
      .filter((q) => q.category === category)
      .map((q) => q.id);
    return {
      ids,
      stats: getStats(category, ids),
      queue: getReviewQueue(category, ids),
    };
  }, [data, category]);

  if (error) return <div className="empty-hint">加载失败: {error}</div>;
  if (!data || !stats) return <div className="empty-hint">加载中…</div>;

  const cat = data.categories.find((c) => c.slug === category);
  const dueCount = queue.dueIds.length;
  const learnPct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;

  return (
    <div>
      <a className="back-link" href="#/">
        ← 全部分类
      </a>
      <div className="app-header">
        <h1>
          <span className="accent">●</span> {cat?.name || category}
        </h1>
      </div>

      <div className="queue-summary">
        {dueCount > 0 ? (
          <>
            <div className="big-num">{dueCount}</div>
            <div className="label">题待复习</div>
            <a className="start-btn" href={`#/${category}/quiz`}>
              开始复习 {'->'}
            </a>
          </>
        ) : stats.remaining > 0 ? (
          <>
            <div className="big-num">{stats.remaining}</div>
            <div className="label">题未学习</div>
            <a className="start-btn" href={`#/${category}/quiz`}>
              开始学习 {'->'}
            </a>
          </>
        ) : (
          <>
            <div className="big-num">✓</div>
            <div className="label">今日已清空，全部学过</div>
            <a className="start-btn" href={`#/${category}/quiz`}>
              再过一遍 {'->'}
            </a>
          </>
        )}

        <div className="progress-bar">
          <div style={{ width: `${learnPct}%` }} />
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-mute)',
          }}
        >
          已学 {stats.learned} / {stats.total} · {learnPct}%
        </div>
      </div>

      <div className="section-title">模块浏览</div>
      <div className="module-grid">
        {cat?.modules.map((mod) => (
          <a
            key={mod.id}
            className="module-item"
            href={`#/${category}/browse?m=${mod.id}`}
          >
            <div className="mod-left">
              <div className="mod-name">{mod.name}</div>
              <div className="mod-id">模块 {String(mod.id).padStart(2, '0')}</div>
            </div>
            <div className="mod-count">{mod.count} 题</div>
          </a>
        ))}
      </div>
    </div>
  );
}
