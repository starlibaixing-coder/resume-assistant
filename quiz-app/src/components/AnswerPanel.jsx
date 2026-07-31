import { renderMarkdown } from '../lib/markdown.js';

// 答案 + 追问展示面板,CardView 和 ModuleNav 共用
export default function AnswerPanel({ answer, followups }) {
  return (
    <div className="answer-panel">
      <div className="panel-label">参考答案要点</div>
      <div
        className="md-body"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.join('\n')) }}
      />
      {followups && followups.length > 0 && (
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
