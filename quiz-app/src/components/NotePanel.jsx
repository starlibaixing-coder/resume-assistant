import { useState, useEffect, useRef } from 'react';
import { getNote, saveNote } from '../lib/storage.js';
import { renderMarkdown } from '../lib/markdown.js';

// 笔记区:输入 markdown + 实时预览 + 防抖自动保存
// props: category, questionId
// 内部自洽,切题时自动加载对应笔记并保存残留输入
export default function NotePanel({ category, questionId }) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(true);
  const debounceRef = useRef(null);
  const latestRef = useRef('');

  // 切题时:加载笔记,决定展开/收起
  useEffect(() => {
    const existing = getNote(category, questionId);
    setText(existing);
    setExpanded(!!existing);
    setSaved(true);
    latestRef.current = existing;

    // 清理函数:切题/卸载前 flush 残留输入,不丢字
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current !== existing) {
        saveNote(category, questionId, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, questionId]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    latestRef.current = val;
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNote(category, questionId, val);
      setSaved(true);
    }, 500);
  };

  // 空且未展开:收起态,显示入口按钮
  if (!expanded && !text) {
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
        <span className={`note-save-status${saved ? ' saved' : ''}`}>
          {saved ? '已保存 ✓' : '编辑中…'}
        </span>
      </div>
      <div className="note-editor">
        <textarea
          className="note-textarea"
          value={text}
          onChange={handleChange}
          placeholder="用自己的话写答案,支持 markdown (**加粗** `代码` 列表等)"
          rows={6}
        />
        <div className="note-preview md-body">
          {text.trim() ? (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
          ) : (
            <span className="note-preview-empty">预览区(在左边写下你的答案)</span>
          )}
        </div>
      </div>
    </div>
  );
}
