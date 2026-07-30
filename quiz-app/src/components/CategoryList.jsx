import { useQuestions } from '../lib/useQuestions.js';
import { getStats } from '../lib/schedule.js';

export default function CategoryList() {
  const { data, error } = useQuestions();

  if (error) return <div className="empty-hint">加载失败: {error}</div>;
  if (!data) return <div className="empty-hint">加载中…</div>;

  return (
    <div>
      <div className="app-header">
        <h1>
          <span className="accent">●</span> 题库 / 选择分类
        </h1>
      </div>

      <div className="category-list">
        {data.categories.map((cat) => {
          const ids = data.questions
            .filter((q) => q.category === cat.slug)
            .map((q) => q.id);
          const stats = getStats(cat.slug, ids);
          return (
            <a
              key={cat.slug}
              className="category-card"
              href={`#/${cat.slug}`}
            >
              <div className="cat-name">{cat.name}</div>
              <div className="cat-desc">{cat.description}</div>
              <div className="cat-meta">
                <span>{cat.modules.length} 模块</span>
                <span>{stats.total} 题</span>
                <span>已学 {stats.learned}</span>
                {stats.dueToday > 0 && (
                  <span className="due-badge">今日待复习 {stats.dueToday}</span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
