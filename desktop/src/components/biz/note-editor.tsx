// 笔记编辑(M3/M4):所见即所得 Markdown + 保存/取消;pending 题不挂载(调用方保证,Q11)。
// 历史笔记为 tiptap HTML 的,展示时转纯文本(不回写)。

import { useEffect, useState } from 'react';
import { SaveIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/biz/markdown-editor';
import { saveNote } from '@/lib/storage';

function htmlToText(s: string): string {
  if (!s.trim().startsWith('<')) return s;
  try {
    const doc = new DOMParser().parseFromString(s, 'text/html');
    return doc.body.textContent ?? '';
  } catch {
    return s;
  }
}

export function NoteEditor({ qid, initial }: { qid: string; initial: string }) {
  const [value, setValue] = useState(() => htmlToText(initial));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(htmlToText(initial));
    setDirty(false);
  }, [qid, initial]);

  const save = () => {
    saveNote(qid, value);
    setDirty(false);
  };

  return (
    <div className="space-y-2">
      <MarkdownEditor
        value={value}
        onChange={(v) => {
          setValue(v);
          setDirty(true);
        }}
        placeholder="记录要点、易错点与自己的思路…"
        testId={`note-editor-${qid}`}
      />
      {dirty && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setValue(htmlToText(initial)); setDirty(false); }}>
            取消
          </Button>
          <Button size="sm" onClick={save}>
            <SaveIcon /> 保存笔记
          </Button>
        </div>
      )}
      {!dirty && value.trim() && <p className="text-right text-[11px] text-muted-foreground">已保存</p>}
    </div>
  );
}
