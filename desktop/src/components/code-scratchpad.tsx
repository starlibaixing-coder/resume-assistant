import { useCallback, useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript';
import { ifNotIn, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { Code2, Play } from 'lucide-react';
import { getCodeDraft, saveCodeDraft } from '@/lib/storage';
import { runJs, DEFAULT_TIMEOUT_MS, type RunLog } from '@/lib/js-runner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 代码草稿纸:题卡上 ghost 图标入口 + 大弹窗承载(2026-08-28 UX 审计 B5):
// 弹窗上半看题、下半 CodeMirror + 运行输出,编辑器不再挤在卡片里。
// 交互/持久化沿 note-panel 模式:同步读缓存初始化、防抖自动保存、切题 flush 原地换内容。
// 运行:每次新起 worker,同步结果先出,异步回调输出继续追加,超时(默认 3s)强制终止。

// 编辑器主题:全部引用仓库 CSS 变量,.dark 切换自动跟随,不落魔法色值(AGENTS.md token 体系)。
// 注意:组件层还要传 theme="none"——@uiw 的 theme 默认 'light',会叠加内置浅色主题
// 把 .cm-editor 背景刷成白色,盖掉这里的 var(--popover)。
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
  { tag: [t.string, t.special(t.string), t.regexp, t.escape], color: 'var(--success)' },
  { tag: [t.number, t.bool, t.null, t.typeName, t.className], color: 'var(--warning)' },
  { tag: [t.comment, t.docComment], color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.definition(t.variableName), t.definition(t.propertyName)], color: 'var(--primary)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.meta], color: 'var(--muted-foreground)' },
  { tag: t.invalid, color: 'var(--destructive)' },
  { tag: [t.propertyName, t.variableName], color: 'var(--foreground)' },
]);

// lang-javascript 自带补全只覆盖关键字/片段/局部变量,console 等全局对象永远不提示;
// 这里补一个小型静态源:常用全局名 + console 的常用成员,挂在语言数据上与自带源叠加。
const GLOBAL_MEMBERS: Record<string, readonly string[]> = {
  console: ['log', 'warn', 'error', 'info', 'debug', 'table', 'time', 'timeEnd'],
};
const GLOBAL_NAMES = [
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Promise', 'Map', 'Set', 'Date', 'setTimeout', 'setInterval', 'clearTimeout',
  'clearInterval', 'fetch', 'document', 'window', 'globalThis',
];

function globalCompletionSource(context: CompletionContext): CompletionResult | null {
  const path = context.matchBefore(/[\w$]*(\.[\w$]*)?$/);
  if (!path) return null;
  const text = path.text;
  const dot = text.lastIndexOf('.');
  if (dot >= 0) {
    const members = GLOBAL_MEMBERS[text.slice(0, dot)];
    if (!members) return null;
    const prefix = text.slice(dot + 1);
    return {
      from: path.from + dot + 1,
      options: members
        .filter((m) => !prefix || m.startsWith(prefix))
        .map((m) => ({ label: m, type: 'method' })),
      validFor: /^[\w$]*$/,
    };
  }
  return {
    from: path.from,
    options: GLOBAL_NAMES
      .filter((n) => !text || n.startsWith(text))
      .map((n) => ({ label: n, type: 'variable' })),
    validFor: /^[\w$]*$/,
  };
}

const extensions = [
  javascript(),
  // 节点名单沿 lang-javascript 自带的 dontComplete:字符串/模板串/正则/注释/定义位不补
  javascriptLanguage.data.of({ autocomplete: ifNotIn(
    ['TemplateString', 'String', 'RegExp', 'LineComment', 'BlockComment', 'VariableDefinition', 'TypeDefinition', 'Label'],
    globalCompletionSource,
  ) }),
  editorTheme,
  syntaxHighlighting(highlightTheme),
];

// basicSetup 必须是稳定引用:@uiw 的 reconfigure effect 依赖它和 onChange,
// 内联字面量 + 每次 render 新建的 onChange 会让每次按键都重建编辑器插件——
// 补全提示刚弹出就被拆掉、选中层(drawSelection)也随之异常。
// closeBrackets 保持关闭:补全 + 回车拆行会和自己输入的闭括号叠加成语法错误(AGENTS.md 约定)。
const BASIC_SETUP = { closeBrackets: false };

// 当前题的上下文(闭包里读 ref,避免切题后闭包过期)
interface ScratchCtx {
  category: string;
  questionId: string;
  initialContent: string;
}

// 弹窗上半要展示的题目信息(quiz 页传入,只取需要的字段)
export interface ScratchpadQuestion {
  difficulty: string;
  title: string;
  focus: string;
}

export default function CodeScratchpad({
  category,
  questionId,
  question,
}: {
  category: string;
  questionId: string;
  question: ScratchpadQuestion;
}) {
  // 首次渲染同步读已有代码(不靠 useEffect,否则首帧拿不到内容)
  const [code, setCode] = useState(() => getCodeDraft(category, questionId));
  const [open, setOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => !!code);
  const [output, setOutput] = useState<RunLog[] | null>(null); // null = 尚未运行过
  const [running, setRunning] = useState(false);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(code);
  const ctxRef = useRef<ScratchCtx>({ category, questionId, initialContent: code });
  // 运行代次:切题/重跑后旧 run 的迟到输出直接丢弃
  const runSeedRef = useRef(0);

  // 稳定引用(空依赖):内部只触达 refs 与稳定的 setCode,供 CodeMirror 的 onChange 使用
  const handleChange = useCallback((value: string) => {
    latestRef.current = value;
    setCode(value);
    setHasDraft(!!value.trim());
    const { category: c, questionId: id } = ctxRef.current;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveCodeDraft(c, id, value), 500);
  }, []);

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
    setHasDraft(!!next);
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

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-label={hasDraft ? '代码草稿纸(有草稿)' : '代码草稿纸'}
            onClick={() => setOpen(true)}
          >
            <Code2 aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{hasDraft ? '代码草稿纸 · 有草稿' : '代码草稿纸'}</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
          // 焦点在 CodeMirror 内时 Esc 归编辑器(radix 的关闭监听在 document 捕获阶段,
          // 不拦会先于补全把整个弹窗关掉)。CM 消费 Esc 会 preventDefault,弹窗不动;
          // 无补全可关时 Esc 不做事,关弹窗走 X / 点击遮罩——防误关代码草稿
          onEscapeKeyDown={(e) => {
            const el = document.activeElement as HTMLElement | null;
            if (el?.closest('.cm-editor')) e.preventDefault();
          }}
        >
          <DialogHeader className="flex-none border-b border-border px-6 py-4 pr-12">
            <DialogTitle className="text-sm font-medium">代码草稿纸 · JavaScript</DialogTitle>
            <DialogDescription className="sr-only">按题保存的代码草稿,自动保存;JS 在沙箱运行</DialogDescription>
          </DialogHeader>

          {/* 上半:当前题(写码不用来回切页面) */}
          <div className="max-h-[26vh] flex-none space-y-2 overflow-y-auto border-b border-border px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{question.difficulty}</Badge>
            </div>
            <div className="text-base font-semibold leading-snug text-foreground">{question.title}</div>
            <div className="text-sm text-muted-foreground">{question.focus}</div>
          </div>

          {/* 下半:编辑器 + 运行输出 */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <Button size="sm" className="h-7 px-2.5 text-xs" onClick={handleRun} disabled={running}>
                <Play className="size-3" aria-hidden />
                {running ? '运行中…' : '运行'}
              </Button>
              <span className="text-[11px] text-muted-foreground">自动保存</span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
              <CodeMirror
                value={code}
                height="100%"
                theme="none"
                extensions={extensions}
                onChange={handleChange}
                aria-label="代码草稿编辑区"
                basicSetup={BASIC_SETUP}
              />
            </div>

            {output !== null && (
              <div className="flex-none rounded-md border border-border bg-popover p-2.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground">输出</span>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
