// 双库聚合 —— mergeQuestionData 纯函数(ADR-3/10)
import { describe, it, expect, beforeEach } from 'vitest';
import { mergeQuestionData } from './questions';
import { addDrafts, approveQuestion, getMyQuestions, _resetMyLibForTest } from './mylib';
import type { QuestionData } from '@/types/question';

const official: QuestionData = {
  categories: [
    { slug: 'agent', name: 'AI Agent', description: '', modules: [{ id: 1, name: '基础', count: 1 }], count: 1 },
  ],
  questions: [
    {
      id: 'agent.01.1', category: 'agent', module: 1, moduleName: '基础', index: 1, type: 'qa',
      difficulty: '初', tags: [], title: 't', focus: 'f', answer: ['a'.repeat(60)], followups: [],
    },
  ],
  total: 1,
};

beforeEach(() => _resetMyLibForTest());

describe('mergeQuestionData', () => {
  it('无我的题时原样返回 official(同引用,不产生空分类)', () => {
    expect(mergeQuestionData(official, [])).toBe(official);
  });

  it('只有 pending 时也不进聚合(ADR-10)', async () => {
    await addDrafts(
      [{
        difficulty: '中', title: 't?', focus: 'f',
        answer: ['a'.repeat(60)], followups: [], tags: [],
      }],
      'X',
    );
    expect(mergeQuestionData(official, getMyQuestions())).toBe(official);
  });

  it('approved 进聚合:拼 my 分类 + 题目 + total', async () => {
    const [q] = await addDrafts(
      [{
        difficulty: '中', title: '我的题?', focus: 'f',
        answer: ['a'.repeat(60)], followups: [], tags: ['x'],
      }],
      'React',
    );
    await approveQuestion(q.id);
    const merged = mergeQuestionData(official, getMyQuestions());
    expect(merged.categories.map((c) => c.slug)).toEqual(['agent', 'my']);
    expect(merged.questions.map((q2) => q2.id)).toEqual(['agent.01.1', 'my.1.1']);
    expect(merged.total).toBe(2);
    // 聚合出的题目不带草稿区字段(与官方题同构,刷题层零改)
    expect('status' in merged.questions[1]).toBe(false);
    expect(merged.categories[1].modules).toEqual([{ id: 1, name: 'React', count: 1 }]);
  });
});
