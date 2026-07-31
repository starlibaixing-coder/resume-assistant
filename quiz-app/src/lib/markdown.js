// 轻量 markdown 渲染封装
// 答案数组项 join('\n') 后整体解析,支持 **bold** / `code` / ```代码块``` / GFM 表格
import { marked } from 'marked';

marked.setOptions({
  breaks: true, // 单换行也转 <br>
  gfm: true, // 表格、删除线等
});

// 缓存:相同文本不重复解析(答案内容静态)
const cache = new Map();

export function renderMarkdown(text) {
  if (cache.has(text)) return cache.get(text);
  const html = marked.parse(text);
  cache.set(text, html);
  return html;
}
