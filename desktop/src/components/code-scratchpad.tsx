import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { tags as t } from '@lezer/highlight';
import { Code2, Play } from 'lucide-react';
import { getCodeDraft, saveCodeDraft } from '@/lib/storage';
import { runJs, DEFAULT_TIMEOUT_MS, type RunLog } from '@/lib/js-runner';
import { Button } from '@/components/ui/button';

// 代码草稿纸:刷题卡片内的按题代码区(CodeMirror)+ JS 运行(Web Worker 沙箱)。
// 交互/持久化沿 note-panel 模式:同步读缓存初始化、防抖自动保存、切题 flush 原地换内容。
// 运行:每次新起 worker,同步结果先出,异步回调输出继续追加,超时(默认 3s)强制终止。

// 编辑器主题:全部引用仓库 CSS 变量,.dark 切换自动跟随,不落魔法色值(AGENTS.md token 体系)
const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--popover)', color: 'var(--foreground)', fontSize: '12.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-gutters': {
    backgroundColor: 'var(--popover)',
    color: 'var(--muted-foreground)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--accent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--accent)', color: 'var(--foreground)' },
  '.cm-content': { padding: '8px 0' },
});

// 语法高亮同样只吃 token:keyword=主色 / 字符串=success / 数字=warning / 注释=muted
const highlightTheme = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: 'var(--primary)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--success)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--warning)' },
  { tag: [t.comment, t.docComment], color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.definition(t.variableName)], color: 'var(--primary)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--muted-foreground)' },
  { tag: [t.propertyName, t.variableName], color: 'var(--foreground)' },
]);

const extensions = [javascript(), editorTheme, syntaxHighlighting(highlightTheme)];

// 当前题的上下文(闭包里读 ref,避免切题后闭包过期)
interface ScratchCtx {
  category: string;
  questionId: string;
  initialContent: string;
}

export default function CodeScratchpad({ category, questionId }: { category: string; questionId: string }) {
  // 首次渲染同步读已有代码(不靠 useEffect,否则首帧拿不到内容)
  const [code, setCode] = useState(() => getCodeDraft(category, questionId));
  const [expanded, setExpanded] = useState(() => !!getCodeDraft(category, questionId));
  const [output, setOutput] = useState<RunLog[] | null>(null); // null = 尚未运行过
  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(code);
  const ctxRef = useRef<ScratchCtx>({ category, questionId, initialContent: code });
  // 运行代次:切题/重跑后旧 run 的迟到输出直接丢弃
  const runSeedRef = useRef(0);

  const handleChange = (value: string) => {
    latestRef.current = value;
    setCode(value);
    const { category: c, questionId: id } = ctxRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveCodeDraft(c, id, value), 500);
  };

  // 切题:flush 旧题未落盘输入 → 换内容、清输出
  useEffect(() => {
    const prev = ctxRef.current;
    if (prev.questionId === questionId && prev.category === category) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (latestRef.current && latestRef.current !== prev.initialContent) {
      saveCodeDraft(prev.category, prev.questionId, latestRef.current);
    }

    runSeedRef.current++; // 旧 run 的异步输出不再进状态
    const next = getCodeDraft(category, questionId);
    latestRef.current = next;
    ctxRef.current = { category, questionId, initialContent: next };
    setCode(next);
    setExpanded(!!next);
    setOutput(null);
    setDurationMs(null);
    setErrorMsg(null);
    setRunning(false);
  }, [category, questionId]);

  // 卸载前 flush 残留输入
  useEffect(() => {
    return () => {
      const cur = ctxRef.current;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current && latestRef.current !== cur.initialContent) {
        saveCodeDraft(cur.category, cur.questionId, latestRef.current);
      }
      runSeedRef.current++;
    };
  }, []);

  const handleRun = () => {
    if (running) return;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const { category: c, questionId: id } = ctxRef.current;
    saveCodeDraft(c, id, latestRef.current); // 运行前先落盘

    const seed = ++runSeedRef.current;
    setRunning(true);
    setOutput([]);
    setDurationMs(null);
    setErrorMsg(null);
    void runJs(latestRef.current, {
      onAsyncLog: (log) => {
        if (runSeedRef.current === seed) setOutput((o) => [...(o ?? []), log]);
      },
    }).then((result) => {
      if (runSeedRef.current !== seed) return; // 已切题/已重跑,丢弃
      setRunning(false);
      setOutput(result.logs.length || !result.error ? result.logs : []);
      setDurationMs(result.durationMs);
      if (result.error) setErrorMsg(result.error);
    });
  };

  // 空且未展开:收起态,显示入口
  if (!expanded) {
    return (
      <div className="mt-3">
        <button
          className="flex w-full items-center justify-center gap-1.5 px-3 py-2 bg-transparent border border-dashed border-border rounded-md text-muted-foreground hover:border-primary hover:text-primary transition-colors text-[13px] cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          <Code2 className="size-3.5" aria-hidden />
          {code ? '打开代码草稿纸(有草稿)' : '代码草稿纸'}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3.5 bg-card border border-border rounded-lg">
      <div className="flex justify-between items-center mb-2.5">
        <span className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          <Code2 className="size-3.5" aria-hidden />
          代码草稿纸 · JavaScript
        </span>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-muted-foreground">自动保存</span>
          <Button size="sm" className="h-7 px-2.5 text-xs" onClick={handleRun} disabled={running}>
            <Play className="size-3" aria-hidden />
            {running ? '运行中…' : '运行'}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <CodeMirror
          value={code}
          height="220px"
          extensions={extensions}
          onChange={handleChange}
          aria-label="代码草稿编辑区"
          // 关掉括号自动补全:补全 + 回车拆行会和自己输入的闭括号叠加成语法错误,
          // 草稿纸要的是所敲即所得(括号匹配高亮仍保留)
          basicSetup={{ closeBrackets: false }}
        />
      </div>

      {output !== null && (
        <div className="mt-2 rounded-md border border-border bg-popover p-2.5">
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">输出</span>
            {durationMs != null && (
              <span className="font-mono text-[10px] text-muted-foreground">{durationMs}ms</span>
            )}
          </div>
          <div
            role="log"
            aria-label="运行输出"
            className="max-h-40 overflow-y-auto font-mono text-xs leading-relaxed"
          >
            {output.length === 0 && !errorMsg && (
              <div className="text-muted-foreground">(无输出;console.log 的内容会显示在这里)</div>
            )}
            {output.map((log, i) => (
              <div
                key={i}
                className={
                  log.level === 'error'
                    ? 'text-destructive'
                    : log.level === 'warn'
                      ? 'text-warning'
                      : 'text-foreground'
                }
              >
                {log.level !== 'log' && <span className="opacity-70">[{log.level}] </span>}
                {log.text}
              </div>
            ))}
            {errorMsg && (
              <div className="text-destructive whitespace-pre-wrap">
                <span className="opacity-70">[error] </span>
                {errorMsg}
              </div>
            )}
            {running && <div className="text-muted-foreground">… 异步输出最多再等 {DEFAULT_TIMEOUT_MS / 1000}s</div>}
          </div>
        </div>
      )}
    </div>
  );
}
