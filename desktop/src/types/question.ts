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
