import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getNote, saveNote } from '../lib/storage.js';

// 笔记区:Tiptap WYSIWYG 所见即所得 + 防抖自动保存
// 外层用 questionId 作 key 强制切题重建,editor 用新 content 初始化
export default function NotePanel({ category, questionId }) {
  return (
    <NotePanelEditor key={questionId} category={category} questionId={questionId} />
  );
}

function NotePanelEditor({ category, questionId }) {
  // 首次渲染同步读已有笔记(不靠 useEffect,否则 useEditor 拿不到初始 content)
  const [initialContent] = useState(() => getNote(category, questionId));
  const [expanded, setExpanded] = useState(() => !!initialContent);
  const debounceRef = useRef(null);
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
      <div className="note-panel note-collapsed">
        <button className="note-entry-btn" onClick={() => setExpanded(true)}>
          ➕ 写笔记
        </button>
      </div>
    );
  }

  return (
    <div className="note-panel">
      <div className="note-header">
        <span className="note-label">📝 我的笔记</span>
        <span className="note-save-status">自动保存</span>
      </div>
      <EditorContent editor={editor} className="note-editor-wrap" />
    </div>
  );
}
