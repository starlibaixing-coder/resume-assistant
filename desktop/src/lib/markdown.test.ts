// lib/markdown 单测:要点数组与 markdown 互转(所见即所得编辑器的载入/落库口径)。
import { describe, expect, it } from 'vitest';

import { markdownToPoints, pointsToMarkdown, renderMarkdown } from './markdown';

describe('pointsToMarkdown / markdownToPoints', () => {
  it('要点按空行分段拼接,空要点被丢弃', () => {
    expect(pointsToMarkdown(['**主流答案**:要点一', '要点二', '', '  '])).toBe('**主流答案**:要点一\n\n要点二');
  });

  it('按空行切块还原要点,两端空白被修剪', () => {
    expect(markdownToPoints('要点一\n\n要点二\n\n\n')).toEqual(['要点一', '要点二']);
    expect(markdownToPoints('  \n\n**粗体**要点')).toEqual(['**粗体**要点']);
  });

  it('空串与纯空白还原为空数组,往返不产生伪要点', () => {
    expect(markdownToPoints('')).toEqual([]);
    expect(markdownToPoints(pointsToMarkdown([]))).toEqual([]);
    expect(markdownToPoints(pointsToMarkdown(['a', 'b']))).toEqual(['a', 'b']);
  });

  it('块内换行(软断行)不拆分要点', () => {
    expect(markdownToPoints('第一行\n第二行')).toEqual(['第一行\n第二行']);
  });
});

describe('renderMarkdown', () => {
  it('渲染粗体与行内代码', () => {
    const html = renderMarkdown('**重点**与 `code`');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('剥离脚本类标签与事件属性(LLM 内容不可信)', () => {
    expect(renderMarkdown('<script>alert(1)</script>正文')).not.toContain('<script');
    expect(renderMarkdown('<img src=x onerror=alert(1)>图')).not.toContain('onerror');
  });

  it('空内容返回空串', () => {
    expect(renderMarkdown('  ')).toBe('');
  });
});
