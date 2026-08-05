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
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef(null);
  const latestRef = useRef('');
  const initialContent = useRef('');

  // 挂载时读已有笔记,决定展开/收起
  useEffect(() => {
    const existing = getNote(category, questionId);
    initialContent.current = existing;
    setExpanded(!!existing);
    latestRef.current = existing;

    // 卸载(切题)前 flush 残留输入
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current && latestRef.current !== initialContent.current) {
        saveNote(category, questionId, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent.current || '',
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
