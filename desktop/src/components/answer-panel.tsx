import { renderMarkdown } from '@/lib/markdown';

interface AnswerPanelProps {
  answer: string[];
  followups: string[];
}

// 题库里有 followups: [''] 的占位写法(为过 build 字段校验),渲染前过滤,
// 否则「追问方向」下会渲染出一个空圆点(2026-09-07 目检实锤)。
const nonEmpty = (items: string[]) => items.filter((s) => s.trim().length > 0);

export function AnswerPanel({ answer, followups }: AnswerPanelProps) {
  const visibleFollowups = nonEmpty(followups);
  return (
    <div className="border-t border-border pt-5 mt-2 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">
        参考答案要点
      </div>
      <div
        className="prose prose-sm dark:prose-invert max-w-[38rem] prose-p:my-1 prose-p:pl-4 prose-p:relative prose-strong:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:font-mono prose-pre:bg-muted prose-li:my-0"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.join('\n')) }}
      />
      {visibleFollowups.length > 0 && (
        <>
          <div className="text-xs font-medium text-muted-foreground pt-2">
            追问方向
          </div>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {visibleFollowups.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
