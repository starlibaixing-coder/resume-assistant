import { useMemo, useState, useEffect } from 'react';
import { useQuestions } from '../lib/useQuestions.js';
import { getReviewQueue } from '../lib/schedule.js';
import { newCard, review } from '../lib/sm2.js';
import { saveCard, loadProgress } from '../lib/storage.js';

export default function CardView({ category }) {
  const { data, error } = useQuestions();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tick, setTick] = useState(0); // 强制刷新 stats

  // 计算队列，tick 变化时重算
  const { queue, catQuestions } = useMemo(() => {
    if (!data) return { queue: [], catQuestions: [] };
    const catQuestions = data.questions.filter((q) => q.category === category);
    const ids = catQuestions.map((q) => q.id);
    return { queue: getReviewQueue(category, ids).queue, catQuestions };
  }, [data, category, tick]);

  const currentId = queue[queueIdx];
  const current = catQuestions.find((q) => q.id === currentId);

  // 切题时重置展开状态
  useEffect(() => {
    setRevealed(false);
  }, [queueIdx, currentId]);

  if (error) return <div className="empty-hint">加载失败: {error}</div>;
  if (!data) return <div className="empty-hint">加载中…</div>;
  if (!queue.length) return <DoneState category={category} />;

  const handleRate = (rating) => {
    const existing = loadProgress(category)[currentId];
    const base = existing || newCard();
    const updated = review(base, rating);
    saveCard(category, currentId, updated);

    if (queueIdx < queue.length - 1) {
      setQueueIdx(queueIdx + 1);
    } else {
      // 队列走完，刷新队列
      setTick((t) => t + 1);
      setQueueIdx(0);
    }
  };

  return (
    <div>
      <a className="back-link" href={`#/${category}`}>
        ← 返回
      </a>

      <div className="card-top">
        <span className="position">
          {queueIdx + 1} / {queue.length}
        </span>
        <span>{current.moduleName}</span>
      </div>

      <div className="card-view">
        <div className="tags-row">
          <span className={`tag diff-${current.difficulty}`}>
            {current.difficulty}
          </span>
          {current.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>

        <div className="q-title">{current.title}</div>
        <div className="q-focus">{current.focus}</div>

        {!revealed ? (
          <div className="answer-locked">
            <button
              className="reveal-btn"
              onClick={() => setRevealed(true)}
            >
              我想好了，看答案
            </button>
            <div className="hint">先在脑中想清楚，再对答案</div>
          </div>
        ) : (
          <AnswerPanel
            answer={current.answer}
            followups={current.followups}
          />
        )}
      </div>

      {revealed && (
        <div className="rating-row">
          <button className="rating-btn rate-不会" onClick={() => handleRate('不会')}>
            不会
          </button>
          <button className="rating-btn rate-模糊" onClick={() => handleRate('模糊')}>
            模糊
          </button>
          <button className="rating-btn rate-掌握" onClick={() => handleRate('掌握')}>
            掌握
          </button>
        </div>
      )}
    </div>
  );
}

function AnswerPanel({ answer, followups }) {
  return (
    <div className="answer-panel">
      <div className="panel-label">参考答案要点</div>
      <ul>
        {answer.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
      {followups.length > 0 && (
        <>
          <div className="panel-label">追问方向</div>
          <ul className="followups">
            {followups.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function DoneState({ category }) {
  return (
    <div>
      <a className="back-link" href={`#/${category}`}>
        ← 返回
      </a>
      <div className="done-state">
        <div className="done-icon">✓</div>
        <div>今日队列已清空</div>
        <a className="done-link" href={`#/${category}/browse`}>
          去浏览全部题目 {'→'}
        </a>
      </div>
    </div>
  );
}
