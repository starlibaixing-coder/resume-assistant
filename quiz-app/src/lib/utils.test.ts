// cn —— clsx + tailwind-merge
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('合并冲突的 tailwind 类(后者胜)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('条件类(clsx: 过滤 falsey)', () => {
    expect(cn('a', false, 'b', undefined, null)).toBe('a b');
  });

  it('空输入返回空串', () => {
    expect(cn()).toBe('');
  });
});
