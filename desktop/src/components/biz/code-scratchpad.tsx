// 代码草稿纸(M3/M4):CodeMirror 编辑 + worker 沙箱运行,按题存代码(code_drafts 表)。
// closeBrackets 保持关闭(补全与手输闭括号叠加会出语法错误);basicSetup/onChange 稳定引用
// (内联对象会让 @uiw 每次按键 reconfigure,补全提示刚弹出就被拆掉,2026-08-27 教训)。

import { useCallback, useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { PlayIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { runJs, type RunLog } from '@/lib/js-runner';
import { saveCodeDraft } from '@/lib/storage';
import { cn } from '@/lib/utils';

const EXTENSIONS = [javascript()];
const BASIC_SETUP = { closeBrackets: false } as const;

export function CodeScratchpad({ qid, initial, className }: { qid: string; initial: string; className?: string }) {
  const [code, setCode] = useState(initial);
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切题重挂(key 由调用方保证);卸载时兜底保存
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const onChange = useCallback(
    (v: string) => {
      setCode(v);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveCodeDraft(qid, v), 400); // 切题防抖保存
    },
    [qid],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setLogs([]);
    setError(null);
    const result = await runJs(code, {
      onAsyncLog: (log) => setLogs((prev) => [...prev, log]),
    });
    setLogs(result.logs);
    setError(result.timedOut ? '运行超时(3s 强制终止)' : result.error);
    setRunning(false);
  }, [code]);

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-lg bg-input/60', className)}>
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <span className="mr-auto text-xs font-medium text-muted-foreground">草稿纸 · JavaScript</span>
        <Button variant="ghost" size="icon-sm" title="清空" onClick={() => { setCode(''); saveCodeDraft(qid, ''); setLogs([]); setError(null); }}>
          <Trash2Icon className="size-3.5" />
        </Button>
        <Button size="sm" variant="secondary" disabled={running} onClick={run} className="h-7 px-2.5 text-xs">
          <PlayIcon className="size-3.5" /> {running ? '运行中…' : '运行'}
        </Button>
      </div>
      <CodeMirror
        value={code}
        onChange={onChange}
        extensions={EXTENSIONS}
        basicSetup={BASIC_SETUP}
        height="200px"
        placeholder="// 随手写点思路,⌘↩ 没绑定这里,点「运行」执行"
      />
      {(logs.length > 0 || error) && (
        <div role="log" aria-label="运行输出" className="max-h-40 overflow-y-auto border-t border-border/60 px-3 py-2 font-mono text-xs leading-relaxed">
          {logs.map((l, i) => (
            <div key={i} className={l.level === 'error' ? 'text-destructive' : l.level === 'warn' ? 'text-warning' : 'text-foreground'}>
              {l.text}
            </div>
          ))}
          {error && <div className="mt-1 text-destructive">{error}</div>}
        </div>
      )}
    </div>
  );
}
