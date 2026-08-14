// 共享校验规则 —— TDD 先行(红),锁住 build/audit/运行时共用的校验契约
import { describe, it, expect } from 'vitest';
import {
  VALID_DIFFICULTIES,
  MIN_ANSWER_CHARS,
  validateQuestion,
  checkIdImmutability,
  checkIdSegmentConsistency,
  type RawQuestion,
} from './validate';

// 合法题基线(answer 恰好达标)
function q(partial: Partial<RawQuestion> = {}): RawQuestion {
  return {
    id: '1.1',
    difficulty: '中',
    title: '题',
    focus: 'f',
    answer: ['x'.repeat(MIN_ANSWER_CHARS)],
    followups: [],
    ...partial,
  };
}

describe('validateQuestion', () => {
  it('合法题无错误', () => {
    expect(validateQuestion(q(), 'f.Q1')).toEqual([]);
  });

  it('缺 id', () => {
    expect(validateQuestion(q({ id: '' }), 'f.Q1')).toContain('f.Q1: 缺 id');
  });

  it('difficulty 非法', () => {
    expect(validateQuestion(q({ difficulty: '简单' }), 'f.Q1'))
      .toContain('f.Q1: difficulty "简单" 不合法(只能 初/中/高)');
  });

  it('difficulty 三个合法值都通过', () => {
    for (const d of VALID_DIFFICULTIES) {
      expect(validateQuestion(q({ difficulty: d }), 'f.Q1')).toEqual([]);
    }
  });

  it('缺 title', () => {
    expect(validateQuestion(q({ title: '' }), 'f.Q1')).toContain('f.Q1: 缺 title');
  });

  it('focus 为 null 报缺 focus', () => {
    expect(validateQuestion(q({ focus: null }), 'f.Q1')).toContain('f.Q1: 缺 focus');
  });

  it('focus 空串不报(==null 才报,空串算有)', () => {
    expect(validateQuestion(q({ focus: '' }), 'f.Q1')).toEqual([]);
  });

  it('answer 非数组', () => {
    expect(validateQuestion(q({ answer: '不是数组' }), 'f.Q1')).toContain('f.Q1: answer 必须是数组');
  });

  it(`answer 正好 ${MIN_ANSWER_CHARS} 字通过(边界)`, () => {
    expect(validateQuestion(q({ answer: ['x'.repeat(MIN_ANSWER_CHARS)] }), 'f.Q1')).toEqual([]);
  });

  it(`answer ${MIN_ANSWER_CHARS - 1} 字判过短`, () => {
    expect(validateQuestion(q({ answer: ['x'.repeat(MIN_ANSWER_CHARS - 1)] }), 'f.Q1'))
      .toContain(`f.Q1: 答案过短(${MIN_ANSWER_CHARS - 1}字 < ${MIN_ANSWER_CHARS})`);
  });

  it('followups 非数组', () => {
    expect(validateQuestion(q({ followups: 'x' }), 'f.Q1')).toContain('f.Q1: followups 必须是数组');
  });

  it('多错误同时收集(不短路)', () => {
    const errs = validateQuestion({}, 'f.Q1');
    expect(errs.length).toBeGreaterThanOrEqual(5);
  });
});

describe('checkIdImmutability', () => {
  it('new 完全包含 baseline → 无错误', () => {
    expect(checkIdImmutability(['a', 'b', 'c'], ['a', 'b'])).toEqual([]);
  });

  it('baseline 有 new 没有 → 报消失(ADR-9)', () => {
    expect(checkIdImmutability(['a', 'b'], ['a', 'b', 'c']))
      .toEqual(['id 消失(不可变约定): c']);
  });

  it('新增 id 允许(不可变 ≠ 不可增)', () => {
    expect(checkIdImmutability(['a', 'b', 'new'], ['a', 'b'])).toEqual([]);
  });

  it('空 baseline 允许任意 new(首次构建/无历史)', () => {
    expect(checkIdImmutability(['a', 'b'], [])).toEqual([]);
  });
});

describe('checkIdSegmentConsistency', () => {
  it('id 段与文件模块号一致 → 无错误', () => {
    expect(checkIdSegmentConsistency('12.1', 12, 'f.Q1')).toEqual([]);
    expect(checkIdSegmentConsistency('03.5', '03', 'f.Q1')).toEqual([]);
  });

  it('不一致 → 报错', () => {
    expect(checkIdSegmentConsistency('13.1', 12, 'f.Q1'))
      .toEqual(['f.Q1: id 段"13"与文件模块号12不一致']);
  });

  it('模块号前缀零容错(01 == 1)', () => {
    expect(checkIdSegmentConsistency('01.1', 1, 'f.Q1')).toEqual([]);
  });
});
