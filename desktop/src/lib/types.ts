// 领域类型(与 SQLite 行映射解耦;行结构见 storage.ts)
// 术语约定(tech-design §3.2):pending=待审核 new=待学习 due=待复习
//                            mastered=已掌握 scheduled=已排期

export type Difficulty = '初' | '中' | '高';

export type QuestionSource = 'official' | 'manual' | 'copy' | 'ai' | 'jd';

export type QStatus = 'approved' | 'pending';

/** 题目领域对象:官方物化(official_questions)与我的题(questions)统一视图 */
export interface Question {
  id: string;
  /** official = 官方库(只读);my = 我的库(可编辑) */
  origin: 'official' | 'my';
  /** 官方分类 slug(fe/agent);我的题固定 'my' */
  category: string;
  module: number;
  moduleName: string;
  index: number;
  difficulty: Difficulty;
  title: string;
  focus: string;
  /** 每条一个要点 */
  answer: string[];
  followups: string[];
  tags: string[];
  status: QStatus;
  source: QuestionSource;
  /** 官方题复制溯源(source_id 列) */
  sourceId: string | null;
  /** 生成来源快照:知识点名 / JD 岗位名(D27;前端补列,无值回退 source 文案) */
  sourceRef: string;
  /** 按 JD 生成时关联 jds.id(E2 统计;JD 删除后悬空) */
  jdId: number | null;
  /** 代码题徽标(仅展示;草稿纸对所有题可用) */
  isCode: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 评分(ADR-0002 三档;quality 映射 no=2 fuzzy=4 ok=5) */
export type Rating = 'no' | 'fuzzy' | 'ok';

/** SM-2 卡片领域态(scheduler 输入/输出) */
export interface CardState {
  ef: number;
  intervalDays: number;
  reps: number;
  lastRating: Rating | null;
  lastRatedAt: number | null;
  dueAt: number;
}

/** 五档互斥状态(deriveStatus 唯一出口,筛选与展示共用) */
export type DerivedStatus = 'pending' | 'new' | 'due' | 'mastered' | 'scheduled';

export const STATUS_LABEL: Record<DerivedStatus, string> = {
  pending: '待审核',
  new: '待学习',
  due: '待复习',
  mastered: '已掌握',
  scheduled: '已排期',
};

export const SOURCE_LABEL: Record<QuestionSource, string> = {
  official: '官方题库',
  manual: '手动添加',
  copy: '官方复制',
  ai: 'AI 生成',
  jd: '按 JD 生成',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 初: '简单', 中: '中等', 高: '困难' };

/** JD */
export interface Jd {
  id: number;
  title: string;
  company: string;
  content: string;
  createdAt: number;
  lastActiveAt: number;
}

/** 求职档案(单行) */
export interface Profile {
  resume: string;
  preferences: string;
}

/** 简历(B6 多份;存量单份由启动迁移搬入) */
export interface Resume {
  id: number;
  name: string;
  content: string;
  updatedAt: number;
}

/** 每日活动聚合行(由 rating_log 派生) */
export interface ActivityDay {
  day: string;
  rated: number;
  ok: number;
  lastAt: number;
}

/** LLM 服务商预设(§5.4 常量表) */
export interface ProviderPreset {
  id: 'zhipu' | 'deepseek' | 'ollama';
  label: string;
  baseUrl: string;
  model: string;
}

export const PROVIDERS: ProviderPreset[] = [
  { id: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { id: 'ollama', label: 'Ollama 本地', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
];

/** 各服务商 API Key 在 secrets 表的存储名(按家分存,互不共用) */
export function apiKeySecretName(providerId: string): string {
  return `llm-api-key:${providerId}`;
}

/** 本地推理服务无需鉴权,Key 可留空 */
export function providerNeedsKey(providerId: string): boolean {
  return providerId !== 'ollama';
}

/** 每次学习题量(meta.batch_size;'all' = 不限量,ADR-0001 复习永远不限量) */
export type BatchSize = '20' | '50' | 'all';
