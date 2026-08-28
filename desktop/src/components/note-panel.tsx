import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { StickyNote } from 'lucide-react';
import { getNote, saveNote } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 笔记:题卡上 ghost 图标入口 + 右侧抽屉(Sheet)承载编辑器(2026-08-28 UX 审计 B6)。
// 编辑器单实例 + setContent 原地换内容防闪烁;tiptap v3 的 EditorContent 卸载时只把
// 视图 DOM 挪到游离节点(不 destroy),抽屉重开原样搬回——关抽屉不丢内容、不重建。
// 同步引入(quiz.tsx 不 React.lazy):懒加载 chunk 会先出兜底再闪出内容,桌面本地没必要。

// 当前题的上下文(onUpdate/清理闭包里读 ref,避免切题后闭包过期)
interface NoteCtx {
  category: string;
  questionId: string;
  initialContent: string;
}

export default function NotePanel({ category, questionId }: { category: string; questionId: string }) {
  return <NotePanelEditor category={category} questionId={questionId} />;
}

function NotePanelEditor({ category, questionId }: { category: string; questionId: string }) {
  // 首次渲染同步读已有笔记(不靠 useEffect,否则 useEditor 拿不到初始 content)
  const [initialContent] = useState(() => getNote(category, questionId));
  const [open, setOpen] = useState(false);
  const [hasNote, setHasNote] = useState(() => !!initialContent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(initialContent);
  const ctxRef = useRef<NoteCtx>({ category, questionId, initialContent });

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || '',
    // 纯 CSR(无 SSR/水合),立即渲染编辑器——false 会推迟到首帧后创建,
    // 打开抽屉时先闪一个空编辑器再出内容。
    immediatelyRender: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      latestRef.current = html;
      setHasNote(!!html && html !== '<p></p>');
      const { category: c, questionId: id } = ctxRef.current;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveNote(c, id, html);
      }, 500);
    },
    editorProps: {
      attributes: {
        // prose 类(Tailwind Typography)给 ul/h1/blockquote/code 等节点提供默认样式。
        class: 'prose prose-sm dark:prose-invert max-w-none',
        'aria-label': '笔记编辑区',
      },
    },
  });

  // 切题:flush 旧题未落盘输入 → 原地换内容,不重建编辑器(消闪烁)
  useEffect(() => {
    const prev = ctxRef.current;
    if (prev.questionId === questionId && prev.category === category) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (latestRef.current && latestRef.current !== prev.initialContent) {
      saveNote(prev.category, prev.questionId, latestRef.current);
    }

    const next = getNote(category, questionId);
    latestRef.current = next;
    ctxRef.current = { category, questionId, initialContent: next };
    editor?.commands.setContent(next || '<p></p>', { emitUpdate: false }); // 不触发 onUpdate
    setHasNote(!!next);
  }, [category, questionId, editor]);

  // 卸载前 flush 残留输入
  useEffect(() => {
    return () => {
      const cur = ctxRef.current;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current && latestRef.current !== cur.initialContent) {
        saveNote(cur.category, cur.questionId, latestRef.current);
      }
    };
  }, []);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-label={hasNote ? '查看笔记(已有笔记)' : '写笔记'}
            onClick={() => setOpen(true)}
          >
            <StickyNote aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{hasNote ? '我的笔记 · 已有笔记' : '写笔记'}</TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="flex-none border-b border-border px-4 py-3">
            <SheetTitle className="text-sm font-medium">我的笔记</SheetTitle>
            <SheetDescription className="sr-only">按题保存的笔记,输入自动保存</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <EditorContent
              editor={editor}
              className="rounded-md border border-border bg-popover overflow-hidden transition-colors focus-within:border-primary [&_.ProseMirror]:min-h-[240px] [&_.ProseMirror]:p-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ol]:my-1 [&_.ProseMirror_li]:my-0 [&_.ProseMirror_p]:my-1 [&_.ProseMirror_h1]:text-[1.25rem] [&_.ProseMirror_h2]:text-[1.1rem] [&_.ProseMirror_h3]:text-[1rem] [&_.ProseMirror_h1]:my-2 [&_.ProseMirror_h2]:my-2 [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_blockquote]:my-1 [&_.ProseMirror_pre]:my-2"
            />
          </div>
          <div className="flex-none border-t border-border px-4 py-2">
            <span className="font-mono text-[11px] text-muted-foreground">自动保存</span>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
