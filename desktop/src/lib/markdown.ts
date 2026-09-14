// 轻量 markdown 渲染(marked):答案要点/追问支持 **粗体**、`代码`、列表。
// LLM 参与的内容不可信:渲染后剥离脚本类标签与事件属性(无 DOMPurify 依赖)。

import { marked } from 'marked';

marked.setOptions({ async: false, gfm: true, breaks: true });

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  for (const el of Array.from(root.querySelectorAll('script,style,iframe,object,embed,link,meta'))) {
    el.remove();
  }
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return root.innerHTML;
}

export function renderMarkdown(text: string): string {
  if (!text?.trim()) return '';
  try {
    return sanitize(marked.parse(text) as string);
  } catch {
    return escapeHtml(text);
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 要点数组 → 单篇 markdown(空行分段:一段/一块 = 一个要点,供 WYSIWYG 编辑器载入) */
export function pointsToMarkdown(points: string[]): string {
  return points.map((p) => p.trim()).filter(Boolean).join('\n\n');
}

/** markdown → 要点数组(按空行分块;连续列表项同属一块,展示时整块经 marked 渲染) */
export function markdownToPoints(md: string): string[] {
  return md.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
}
