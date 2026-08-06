import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getNote, saveNote } from '@/lib/storage';

// 笔记区:Tiptap WYSIWYG 所见即所得 + 防抖自动保存
// 外层用 questionId 作 key 强制切题重建,editor 用新 content 初始化
// default export(React.lazy 需要)
export default function NotePanel({ category, questionId }: { category: string; questionId: string }) {
  return (
    <NotePanelEditor key={questionId} category={category} questionId={questionId} />
  );
}

function NotePanelEditor({ category, questionId }: { category: string; questionId: string }) {
  // 首次渲染同步读已有笔记(不靠 useEffect,否则 useEditor 拿不到初始 content)
  const [initialContent] = useState(() => getNote(category, questionId));
  const [expanded, setExpanded] = useState(() => !!initialContent);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(initialContent);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || '',
    immediatelyRender: false, // 避免 SSR/挂载时序问题(Tiptap 官方推荐)
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      latestRef.current = html;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveNote(category, questionId, html);
      }, 500);
    },
    editorProps: {
      attributes: {
        class: 'note-prose',
        'aria-label': '笔记编辑区',
      },
    },
  });

  // 卸载(切题)前 flush 残留输入
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current && latestRef.current !== initialContent) {
        saveNote(category, questionId, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 空且未展开:收起态,显示入口按钮
  if (!expanded) {
    return (
      <div className="mt-4">
        <button
          className="w-full px-3 py-2 bg-transparent border border-dashed border-border rounded-md text-muted-foreground hover:border-primary hover:text-primary transition-colors text-[13px]"
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
        className="bg-popover border border-border rounded-md overflow-hidden focus-within:border-primary transition-colors [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[320px] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:p-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground"
      />
    </div>
  );
}
