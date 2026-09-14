// 所见即所得 Markdown 编辑器(Tiptap + tiptap-markdown):
// 「### 」即打即变标题,**粗体**、`代码`、列表原生渲染;内容仍是 Markdown 存储——
// 载入经 markdown 解析,onChange 序列化回 Markdown,展示端继续走 marked(lib/markdown)。

import { useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';

import { cn } from '@/lib/utils';

interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 传给编辑内容体的附加 class(如覆盖最小高度) */
  editorClassName?: string;
  testId?: string;
  className?: string;
}

export function MarkdownEditor({ value, onChange, placeholder, editorClassName, testId, className }: MarkdownEditorProps) {
  const lastEmitted = useRef(value);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder }),
        Markdown.configure({ breaks: true, linkify: false }),
      ],
      content: value,
      onUpdate: ({ editor }) => {
        const md = editor.storage.markdown.getMarkdown();
        lastEmitted.current = md;
        onChange(md);
      },
      editorProps: {
        attributes: {
          class: cn(
            'tiptap min-h-20 w-full rounded-md bg-input/70 px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            editorClassName,
          ),
        },
      },
    },
    [],
  );

  // 外部值回填(切题/取消恢复):只同步非本编辑器产生的变更,避免归一化差异造成回写抖动
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value);
  }, [editor, value]);

  return (
    <EditorContent
      editor={editor}
      data-testid={testId}
      className={cn(
        '[&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]',
        '[&_h1]:mt-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold',
        '[&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-medium [&_li]:ml-4 [&_li]:list-disc',
        '[&_ol]:list-decimal [&_ol_li]:list-decimal [&_p]:my-1.5 [&_p:first-child]:mt-0',
        '[&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2',
        className,
      )}
    />
  );
}
