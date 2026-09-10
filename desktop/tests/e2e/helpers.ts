// e2e 公共件:web 降级模式(无 Tauri IPC → 内存存储;官方库走 vite 静态 questions.json)。
// 数据经 window.__cc(dev 钩子)播种;远端同步请求一律拦包内同款,保证确定性离线。

import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

export const BUNDLED_BANK = JSON.parse(
  readFileSync(new URL('../../public/questions.json', import.meta.url), 'utf8'),
) as { categories: { slug: string; name: string; description: string }[]; questions: Record<string, unknown>[] };

export async function stubRemote(page: Page): Promise<void> {
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: BUNDLED_BANK }));
}

/** window.__cc 里播种一道题的参数(结构 = storage.Question) */
export function questionSeed(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    id,
    origin: 'my',
    category: 'my',
    module: 1,
    moduleName: '测试模块',
    index: 1,
    difficulty: '中',
    title: `测试题 ${id}`,
    focus: '考察 e2e 链路',
    answer: ['这是一条足够长的答案要点,用于通过五十字预检与展示断言,内容本身不重要但长度必须达标才行。', '第二个要点,保证答案合计远超五十字下限。'],
    followups: ['追问一'],
    tags: ['e2e'],
    status: 'approved',
    source: 'manual',
    sourceId: null,
    sourceRef: '',
    jdId: null,
    isCode: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

export interface SeedHandle {
  seed(questions: Record<string, unknown>[], cards?: Record<string, unknown>): void;
}

export async function seedData(
  page: Page,
  questions: Record<string, unknown>[],
  cards?: Record<string, unknown>,
  ratingLog?: { question_id: string; day: string; rating: string; rated_at: number }[],
): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __cc?: unknown }).__cc);
  await page.evaluate(
    ({ questions, cards, ratingLog }) => {
      const cc = (window as unknown as {
        __cc: { _seedForTest: (s: { my?: unknown[]; cards?: unknown; ratingLog?: unknown[] }) => void };
      }).__cc;
      cc._seedForTest({ my: questions as unknown[], cards, ratingLog });
    },
    { questions, cards, ratingLog },
  );
}
