export type Difficulty = '初' | '中' | '高';
export type Rating = '不会' | '模糊' | '掌握';

export interface Question {
  id: string;
  category: string;
  module: number;
  moduleName: string;
  index: number;
  type: 'qa';
  difficulty: Difficulty;
  tags: string[];
  title: string;
  focus: string;
  answer: string[];
  followups: string[];
}

export interface CategoryModule {
  id: number;
  name: string;
  count: number;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  modules: CategoryModule[];
  count: number;
}

export interface QuestionData {
  categories: Category[];
  questions: Question[];
  total: number;
}

// ===== 我的库(SQLite questions 表,ADR-3 双库) =====

// ADR-10 草稿区:AI 生成先进 pending,用户 approve 后才进刷题/SM-2
export type MyQuestionStatus = 'pending' | 'approved';

export interface MyQuestion extends Question {
  status: MyQuestionStatus;
  createdAt: number;
  updatedAt: number;
  // 官方题副本的来源官方题 id(ADR-3 复制后改);生题批次无此字段
  sourceId?: string | null;
}
