import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getNote, saveNote } from '@/lib/storage';

// 笔记区:Tiptap WYSIWYG 所见即所得 + 防抖自动保存。
// 切题不重建编辑器(单实例 + setContent 原地换内容)——重建会闪一下空态。
// 同步引入(quiz.tsx 不再 React.lazy):懒加载 chunk 会先出「加载笔记…」兜底再闪出内容,
// 桌面本地加载没有省体积的必要。

export default function NotePanel({ category, questionId }: { category: string; questionId: string }) {
  return <NotePanelEditor category={category} questionId={questionId} />;
}

// 当前题的上下文(onUpdate/清理闭包里读 ref,避免切题后闭包过期)
interface NoteCtx {
  category: string;
  questionId: string;
  initialContent: string;
}

function NotePanelEditor({ category, questionId }: { category: string; questionId: string }) {
  // 首次渲染同步读已有笔记(不靠 useEffect,否则 useEditor 拿不到初始 content)
  const [initialContent] = useState(() => getNote(category, questionId));
  const [expanded, setExpanded] = useState(() => !!initialContent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(initialContent);
  const ctxRef = useRef<NoteCtx>({ category, questionId, initialContent });

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || '',
    // 纯 CSR(无 SSR/水合),立即渲染编辑器——false 会推迟到首帧后创建,
    // 展开笔记时先闪一个空编辑器再出内容。
    immediatelyRender: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      latestRef.current = html;
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
    setExpanded(!!next);
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

  // 空且未展开:收起态,显示入口按钮
  if (!expanded) {
    return (
      <div className="mt-4">
        <button
          className="w-full px-3 py-2 bg-transparent border border-dashed border-border rounded-md text-muted-foreground hover:border-primary hover:text-primary transition-colors text-[13px] cursor-pointer"
          onClick={() => setExpanded(true)}
        >
          ➕ 写笔记
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 p-3.5 bg-card border border-border rounded-lg">
      <div className="flex justify-between items-center mb-2.5">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          📝 我的笔记
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">自动保存</span>
      </div>
      <EditorContent
        editor={editor}
        className="bg-popover border border-border rounded-md overflow-hidden focus-within:border-primary transition-colors [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[320px] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:p-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ol]:my-1 [&_.ProseMirror_li]:my-0 [&_.ProseMirror_p]:my-1 [&_.ProseMirror_h1]:text-[1.25rem] [&_.ProseMirror_h2]:text-[1.1rem] [&_.ProseMirror_h3]:text-[1rem] [&_.ProseMirror_h1]:my-2 [&_.ProseMirror_h2]:my-2 [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_blockquote]:my-1 [&_.ProseMirror_pre]:my-2"
      />
    </div>
  );
}
