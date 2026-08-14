// marked 封装 —— 验证渲染正确性 + 幂等
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('加粗', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
  });

  it('行内代码', () => {
    expect(renderMarkdown('use `x`')).toContain('<code>x</code>');
  });

  it('代码块', () => {
    const html = renderMarkdown('```js\nfoo()\n```');
    expect(html).toContain('<pre');
    expect(html).toContain('<code');
  });

  it('GFM 表格', () => {
    const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(html).toContain('<table');
  });

  it('幂等: 相同输入返回相同输出', () => {
    expect(renderMarkdown('**x**')).toBe(renderMarkdown('**x**'));
  });
});
