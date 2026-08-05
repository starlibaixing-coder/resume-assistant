import { useMemo, useState, useEffect } from 'react';
import { useQuestions } from '../lib/useQuestions.js';
import { getReviewQueue } from '../lib/schedule.js';
import { newCard, review } from '../lib/sm2.js';
import { saveCard, loadProgress } from '../lib/storage.js';
import AnswerPanel from './AnswerPanel.jsx';
import NotePanel from './NotePanel.jsx';

export default function CardView({ category }) {
  const { data, error } = useQuestions();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false); // 本轮 N 题是否刷完
  const [round, setRound] = useState(0); // 轮次,变化时重算队列

  // 计算队列,round 变化时重算(续刷下一轮时)
  const { queue, catQuestions } = useMemo(() => {
    if (!data) return { queue: [], catQuestions: [] };
    const catQuestions = data.questions.filter((q) => q.category === category);
    const ids = catQuestions.map((q) => q.id);
    // 从 URL 读取每次题量,默认 50,0=全部
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const limitParam = params.get('limit');
    const limit = limitParam != null ? parseInt(limitParam, 10) || 0 : 50;
    return { queue: getReviewQueue(category, ids, limit).queue, catQuestions };
  }, [data, category, round]);

  const currentId = queue[queueIdx];
  const current = catQuestions.find((q) => q.id === currentId);

  // 切题时重置展开状态
  useEffect(() => {
    setRevealed(false);
  }, [queueIdx, currentId]);

  const handleRate = (rating) => {
    const existing = loadProgress(category)[currentId];
    const base = existing || newCard();
    const updated = review(base, rating);
    saveCard(category, currentId, updated);

    if (queueIdx < queue.length - 1) {
      setQueueIdx(queueIdx + 1);
    } else {
      // 本轮刷完,显示完成态,不自动补位
      setRoundDone(true);
    }
  };

  const handleNextRound = () => {
    setRound((r) => r + 1); // 触发队列重算
    setQueueIdx(0);
    setRoundDone(false);
    setRevealed(false);
  };

  if (error) return <div className="empty-hint">加载失败: {error}</div>;
  if (!data) return <div className="empty-hint">加载中…</div>;
  if (!queue.length) return <DoneState category={category} />;
  if (roundDone) return <RoundDoneState category={category} done={queue.length} onNextRound={handleNextRound} />;

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

        <NotePanel category={category} questionId={current.id} />

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
          去浏览全部题目 {'->'}
        </a>
      </div>
    </div>
  );
}

function RoundDoneState({ category, done, onNextRound }) {
  return (
    <div>
      <a className="back-link" href={'#/' + category}>
        ← 返回
      </a>
      <div className="done-state">
        <div className="done-icon">✓</div>
        <div>本轮完成,刷了 {done} 题</div>
        <button className="done-link" onClick={onNextRound}>
          继续刷下一轮
        </button>
        <a className="done-link" href={'#/' + category + '/browse'}>
          去浏览全部题目
        </a>
      </div>
    </div>
  );
}
