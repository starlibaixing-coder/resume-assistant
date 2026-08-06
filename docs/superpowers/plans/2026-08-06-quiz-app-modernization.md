# 刷题站现代化重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 quiz-app 从纯 JSX + 手写 CSS 全量迁移到 TypeScript + Tailwind v4 + shadcn/ui,加主题三选一、清除进度(两按钮)、首页介绍,Tiptap 笔记懒加载,React 18→19 + Vite 5→7 升级。

**Architecture:** 先搭地基(React19/Vite7/TS/Tailwind v4/shadcn + token 体系),再迁 lib 层(类型化),再逐个重写 UI 组件(JX→TSX + shadcn),最后加主题/清除/首页/Tiptap 懒加载。localStorage key 全程不变,数据零迁移。

**Tech Stack:** React 19 + Vite 7 + TypeScript 5.9 + Tailwind v4(@tailwindcss/vite) + shadcn/ui + clsx/tailwind-merge + lucide-react。保留 @tiptap/react、marked、js-yaml。

**设计依据:** `docs/superpowers/specs/2026-08-06-quiz-app-modernization-design.md`

**测试说明:** 项目无测试框架。验证 = `tsc --noEmit`(类型)+ `npm run build`(构建)+ 浏览器手测(主 agent 用 control-browser)。

**⚠️ 关键约束(来自 tailwind-v4-shadcn skill,违反会踩坑):**
- 用 `@tailwindcss/vite` 插件,**不**用 PostCSS
- **删掉** `tailwind.config.ts`(v4 不用)
- `:root` 和 `.dark` 在**根级**(不在 `@layer base` 内)
- 颜色值用 `hsl()` 包装
- `@theme inline` 映射变量到工具类
- `@layer base` 用**未包装**变量(`var(--x)` 不是 `hsl(var(--x))`)
- `components.json` 的 `tailwind.config` = `""`
- **不**装 `tailwindcss-animate` / `tw-animate-css`(已废弃)

---

## 文件结构

**新增:**
- `quiz-app/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`
- `quiz-app/components.json`
- `quiz-app/src/vite-env.d.ts`
- `quiz-app/src/types/question.ts`
- `quiz-app/src/lib/utils.ts`
- `quiz-app/src/lib/theme.tsx`(ThemeProvider)
- `quiz-app/src/components/ui/*`(shadcn 生成)
- `quiz-app/src/components/mode-toggle.tsx`
- `quiz-app/src/components/home-page.tsx`

**重写**(JSX→TSX / 手写 CSS→Tailwind):
- `quiz-app/vite.config.js` → `vite.config.ts`
- `quiz-app/src/index.css`(全重写)
- `quiz-app/src/main.jsx` → `main.tsx`
- `quiz-app/src/App.jsx` → `App.tsx`
- `quiz-app/src/lib/*` 6 个(.js → .ts/.tsx)
- `quiz-app/src/components/*` 5 个组件(.jsx → .tsx,CategoryList 删除)

**配置:**
- `quiz-app/package.json`(依赖增删、scripts)
- `quiz-app/package-lock.json`(重生成)

---

## Task 1: 升级 React/Vite + 装 TS/Tailwind/shadcn 依赖

**Files:**
- Modify: `quiz-app/package.json`(via npm)

**先开 feature 分支。**

- [ ] **Step 1: 开 feature 分支**

```bash
cd /Users/hetao2/idea/resume-assistant
git checkout -b feat/quiz-app-modern
```

- [ ] **Step 2: 升级 React 18→19 + Vite 5→7**

```bash
cd quiz-app
npm install react@19 react-dom@19
npm install -D vite@7 @vitejs/plugin-react@latest
```

- [ ] **Step 3: 装 TypeScript + 类型**

```bash
npm install -D typescript@5.9 @types/node @types/react @types/react-dom
```

- [ ] **Step 4: 装 Tailwind v4 + shadcn 依赖**

```bash
npm install tailwindcss@4 @tailwindcss/vite@4
npm install clsx tailwind-merge lucide-react
```

- [ ] **Step 5: 确认版本一致**

Run: `npm ls react react-dom vite typescript tailwindcss @tailwindcss/vite 2>&1 | head -10`
Expected: React 19.x、Vite 7.x、TS 5.9.x、Tailwind 4.x,无 peer 警告(若有 React 19 相关 peer 警告可忽略,@types/react 19 已兼容)。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(quiz-app): 升级 React19/Vite7 + 装 TS/Tailwind4 依赖"
```

---

## Task 2: 配置 TS + Vite + Tailwind(shadcn 地基)

**Files:**
- Create: `quiz-app/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `quiz-app/components.json`
- Create: `quiz-app/src/vite-env.d.ts`
- Rewrite: `quiz-app/vite.config.js` → `vite.config.ts`
- Delete: `quiz-app/vite.config.js`

- [ ] **Step 1: 创建 tsconfig 三件套**

`quiz-app/tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`quiz-app/tsconfig.app.json`(基于 skill 模板,改 jsx 为 react-jsx):
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

`quiz-app/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 2: 创建 vite-env.d.ts**

`quiz-app/src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: 重写 vite.config 为 TS + 加 Tailwind 插件 + path alias**

删除 `quiz-app/vite.config.js`,创建 `quiz-app/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/resume-assistant/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: 创建 components.json(shadcn 配置)**

`quiz-app/components.json`(直接用 skill 模板):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 5: 加 tsc 脚本到 package.json**

在 `quiz-app/package.json` 的 scripts 里加:
```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 6: 临时清空 index.css(下个 task 重写),确认 TS + Vite 跑通**

临时把 `quiz-app/src/index.css` 内容替换为一行(下个 Task 会重写):
```css
@import "tailwindcss";
```

Run: `npm run typecheck`
Expected: 此时还有 .jsx/.js 文件,可能报错正常。只要 TS 配置本身不报错(tsc 能跑起来)。若报 `Cannot find module './vite.config'`,确认 vite.config.js 已删除、vite.config.ts 已创建。

Run: `npm run dev`,打开浏览器确认能启动(此时样式会丢,正常)。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(quiz-app): 配置 TS/Vite7/Tailwind4 地基

tsconfig 三件套 + @/ 路径别名 + vite.config.ts + components.json。"
```

---

## Task 3: 重写 index.css(Tailwind v4 + shadcn token 体系)

**Files:**
- Rewrite: `quiz-app/src/index.css`

这是整个重构的核心——所有组件的颜色都依赖它。严格按 skill 四步架构。

- [ ] **Step 1: 重写 index.css**

`quiz-app/src/index.css` 全量替换为:

```css
@import "tailwindcss";

/* Step 1: 浅色 token(:root) - 值用 hsl() 包装 */
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(222 47% 11%);

  --card: hsl(0 0% 100%);
  --card-foreground: hsl(222 47% 11%);

  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(222 47% 11%);

  --primary: hsl(18 78% 52%);          /* 暖橙 #e8825a 浅色版 */
  --primary-foreground: hsl(0 0% 100%);

  --secondary: hsl(210 40% 96%);
  --secondary-foreground: hsl(222 47% 11%);

  --muted: hsl(210 40% 96%);
  --muted-foreground: hsl(215 16% 47%);  /* 次文字 */

  --accent: hsl(210 40% 96%);
  --accent-foreground: hsl(222 47% 11%);

  --destructive: hsl(0 84% 60%);       /* 红 #e85a5a */
  --destructive-foreground: hsl(0 0% 100%);

  --success: hsl(142 71% 45%);         /* 绿 #6bbf6b 浅色版 */
  --success-foreground: hsl(0 0% 100%);

  --warning: hsl(38 92% 50%);          /* 黄 #e8c25a */
  --warning-foreground: hsl(0 0% 100%);

  --border: hsl(214 32% 91%);
  --input: hsl(214 32% 91%);
  --ring: hsl(18 78% 52%);

  --radius: 0.625rem;                  /* 10px */
}

/* Step 1 续:深色 token(.dark) - 沿用现有深色调 */
.dark {
  --background: hsl(222 47% 7%);       /* #0f1115 近似 */
  --foreground: hsl(220 14% 91%);      /* #e6e8ec */

  --card: hsl(222 30% 12%);            /* #181b22 近似 */
  --card-foreground: hsl(220 14% 91%);

  --popover: hsl(222 33% 15%);         /* #1d2129 近似 */
  --popover-foreground: hsl(220 14% 91%);

  --primary: hsl(18 78% 64%);          /* 暖橙 深色版调亮 */
  --primary-foreground: hsl(0 0% 100%);

  --secondary: hsl(222 30% 15%);
  --secondary-foreground: hsl(220 14% 91%);

  --muted: hsl(222 30% 15%);
  --muted-foreground: hsl(217 10% 65%);  /* #9aa0ac 近似 */

  --accent: hsl(222 30% 18%);
  --accent-foreground: hsl(220 14% 91%);

  --destructive: hsl(0 84% 60%);
  --destructive-foreground: hsl(0 0% 100%);

  --success: hsl(142 60% 50%);
  --success-foreground: hsl(0 0% 100%);

  --warning: hsl(38 92% 57%);
  --warning-foreground: hsl(222 47% 11%);

  --border: hsl(222 20% 20%);          /* #2a2f3a 近似 */
  --input: hsl(222 20% 20%);
  --ring: hsl(18 78% 64%);
}

/* Step 2: 映射变量到 Tailwind 工具类 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
  --font-sans: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "Segoe UI", Helvetica, Arial, sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace;
}

/* Step 3: base 样式(用未包装变量) */
@layer base {
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: var(--font-sans);
  }
}
```

- [ ] **Step 2: 验证 Tailwind 工具类生成**

Run: `npm run build`
Expected: 构建成功。CSS 体积比之前小(只剩 token + base)。

(此时代码还是 .jsx,没用到新 token,但 CSS 本身要能构建。下个 task 开始迁 lib 层会用到。)

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(quiz-app): 重写 index.css 为 Tailwind v4 + shadcn token 体系

浅色/深色双套 token,暖橙品牌色保留。自定义 success/warning 语义色。
严格按 tailwind-v4-shadcn skill 四步架构。"
```

---

## Task 4: 创建 cn 工具 + 类型定义 + ThemeProvider

**Files:**
- Create: `quiz-app/src/lib/utils.ts`
- Create: `quiz-app/src/types/question.ts`
- Create: `quiz-app/src/lib/theme.tsx`

这些是后续所有组件的基础依赖。

- [ ] **Step 1: 创建 cn 工具**

`quiz-app/src/lib/utils.ts`:
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: 创建题库数据类型**

`quiz-app/src/types/question.ts`:
```ts
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
```

- [ ] **Step 3: 创建 ThemeProvider(基于 skill 模板)**

`quiz-app/src/lib/theme.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'quiz-theme',
  ...props
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (t: Theme) => {
      try {
        localStorage.setItem(storageKey, t);
      } catch {
        // 隐私模式静默
      }
      setTheme(t);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
```

- [ ] **Step 4: 验证类型**

Run: `npm run typecheck`
Expected: 新文件无类型错误(旧 .jsx 不受 tsconfig include 约束,但 tsc 可能扫到——若报错先忽略,后续 task 会迁)。

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/types/question.ts src/lib/theme.tsx
git commit -m "feat(quiz-app): 新增 cn 工具 + 题库类型定义 + ThemeProvider"
```

---

## Task 5: 迁移 lib 层到 TS(sm2/schedule/storage/markdown/questions)

**Files:**
- `quiz-app/src/lib/sm2.js` → `sm2.ts`
- `quiz-app/src/lib/schedule.js` → `schedule.ts`
- `quiz-app/src/lib/storage.js` → `storage.ts`
- `quiz-app/src/lib/markdown.js` → `markdown.ts`
- `quiz-app/src/lib/useQuestions.js` → `questions.ts`

逐个迁移,逻辑不变,加类型签名。**localStorage key 全程不变。**

- [ ] **Step 1: 迁移 sm2.ts**

先读现有 `quiz-app/src/lib/sm2.js` 理解逻辑,然后创建 `sm2.ts`(同名 .js 删除):

```ts
import type { Rating } from '@/types/question';

export interface CardState {
  due: number;       // due 时间戳(ms)
  interval: number;  // 间隔(天)
  ease: number;      // 难度系数
  reps: number;      // 连续通过次数
}

export function newCard(): CardState {
  return { due: Date.now(), interval: 0, ease: 2.5, reps: 0 };
}

export function isDue(card: CardState): boolean {
  return card.due <= Date.now();
}

// 三档评分 -> SM-2 更新
export function review(card: CardState, rating: Rating): CardState {
  const updated = { ...card };
  updated.reps += 1;

  if (rating === '不会') {
    updated.interval = 1;
    updated.ease = Math.max(1.3, updated.ease - 0.2);
    updated.due = Date.now() + 1 * 24 * 60 * 60 * 1000;
  } else if (rating === '模糊') {
    updated.interval = updated.interval === 0 ? 1 : Math.round(updated.interval * 1.3);
    updated.ease = Math.max(1.3, updated.ease - 0.05);
    updated.due = Date.now() + updated.interval * 24 * 60 * 60 * 1000;
  } else {
    // 掌握
    if (updated.interval === 0) updated.interval = 1;
    else if (updated.interval === 1) updated.interval = 3;
    else updated.interval = Math.round(updated.interval * updated.ease);
    updated.ease = updated.ease + 0.1;
    updated.due = Date.now() + updated.interval * 24 * 60 * 60 * 1000;
  }
  return updated;
}

export function isMastered(card: CardState | null): boolean {
  return !!card && card.interval >= 3;
}
```

⚠️ **必须先读现有 sm2.js 核对算法逻辑**——上面是示意,迁移时把现有逻辑原样搬过来加类型,不改算法。

- [ ] **Step 2: 迁移 storage.ts**

读现有 `storage.js`,创建 `storage.ts`。**key 不变**(`quiz-progress:` / `quiz-notes-v2:`)。签名:

```ts
import type { CardState } from './sm2';

export function loadProgress(category: string): Record<string, CardState> { ... }
export function saveCard(category: string, id: string, card: CardState): void { ... }
export function getCard(category: string, id: string): CardState | null { ... }
export function clearProgress(category: string): void { ... }

export function loadNotes(category: string): Record<string, string> { ... }
export function saveNote(category: string, id: string, html: string): void { ... }
export function getNote(category: string, id: string): string { ... }
export function clearNotes(category: string): void { ... }
```

逻辑原样保留(try/catch 容错、空内容 delete key 等)。

- [ ] **Step 3: 迁移 schedule.ts**

读现有 `schedule.js`,创建 `schedule.ts`。导出类型:

```ts
import type { Question } from '@/types/question';
import type { CardState } from './sm2';

export type QuestionStatus = 'unseen' | 'due' | 'learning' | 'mastered';

export interface ModuleStats {
  total: number; learned: number; mastered: number; dueToday: number;
  byDifficulty: Record<string, { total: number; learned: number }>;
}

export function getReviewQueue(category: string, ids: string[], limit?: number): {
  dueIds: string[]; unseen: string[]; queue: string[];
} { ... }

export function getStats(category: string, ids: string[]): {
  total: number; learned: number; dueToday: number; remaining: number;
} { ... }

export function getModuleStats(category: string, questions: Question[]): Record<number, ModuleStats> { ... }
export function getQuestionStatus(category: string, id: string): QuestionStatus { ... }
```

逻辑原样保留。

- [ ] **Step 4: 迁移 markdown.ts**

```ts
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

const cache = new Map<string, string>();

export function renderMarkdown(text: string): string {
  if (cache.has(text)) return cache.get(text)!;
  const html = marked.parse(text) as string;
  cache.set(text, html);
  return html;
}
```

注意:`marked.parse` 返回 `string | Promise<string>`,同步模式下是 string,需 `as string`。

- [ ] **Step 5: 迁移 questions.ts(原 useQuestions.js)**

```ts
import { useState, useEffect } from 'react';
import type { QuestionData } from '@/types/question';

export function useQuestions(): { data: QuestionData | null; error: string | null } {
  // 原 useQuestions 逻辑,fetch BASE_URL + 'questions.json'
  // 保留原有逻辑,加返回类型
}
```

- [ ] **Step 6: 删除旧的 .js 文件,确认无残留**

```bash
rm -f src/lib/sm2.js src/lib/schedule.js src/lib/storage.js src/lib/markdown.js src/lib/useQuestions.js
```

⚠️ 此时组件还是 .jsx 且 import 的是 .js 路径——会报错。这是预期的,下个 task 迁组件。先确认 lib 层自身类型正确。

Run: `npm run typecheck` → lib 层新文件应无错误(组件报错忽略)。

- [ ] **Step 7: Commit**

```bash
git add src/lib/ src/types/
git commit -m "refactor(quiz-app): lib 层迁移到 TS(sm2/schedule/storage/markdown/questions)

逻辑不变,加类型签名。localStorage key 不变,数据零迁移。"
```

---

## Task 6: 安装 shadcn 基础组件

**Files:**
- Create: `quiz-app/src/components/ui/*`(shadcn 生成)

- [ ] **Step 1: 用 shadcn CLI 装组件**

shadcn CLI 在 npm 下用 `npx`。逐个装(用到的):

```bash
cd quiz-app
npx shadcn@latest add button card badge progress separator dropdown-menu dialog textarea
```

若 `npx shadcn` 因 npm/bun 兼容性问题失败,回退方案:手动从 https://ui.shadcn.com/docs/components 拷贝对应组件到 `src/components/ui/`。每个组件都依赖 `@/lib/utils` 的 `cn()`(Task 4 已建)。

- [ ] **Step 2: 确认组件生成**

Run: `ls src/components/ui/`
Expected: button.tsx、card.tsx、badge.tsx、progress.tsx、separator.tsx、dropdown-menu.tsx、dialog.tsx、textarea.tsx

- [ ] **Step 3: 验证类型**

Run: `npm run typecheck`
Expected: ui 组件无类型错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat(quiz-app): 安装 shadcn 基础组件(button/card/badge/progress 等)"
```

---

## Task 7: 重写 main.tsx + App.tsx(路由 + ThemeProvider)

**Files:**
- `quiz-app/src/main.jsx` → `main.tsx`
- `quiz-app/src/App.jsx` → `App.tsx`

- [ ] **Step 1: 重写 main.tsx**

读现有 `main.jsx`(挂载 App + import index.css),创建 `main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/lib/theme';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="quiz-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);
```

删除 `main.jsx`。

- [ ] **Step 2: 重写 App.tsx(路由 + 全局布局)**

读现有 `App.jsx` 的 hash 路由逻辑,迁移到 TSX。路由加 HomePage:

```tsx
import { useEffect, useState } from 'react';
import { HomePage } from '@/components/home-page';
import { ReviewQueue } from '@/components/review-queue';
import { CardView } from '@/components/card-view';
import { ModuleNav } from '@/components/module-nav';
import { ModeToggle } from '@/components/mode-toggle';

function parseHash(): string[] {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path] = raw.split('?');
  return path.split('/').filter(Boolean);
}

export default function App() {
  const [parts, setParts] = useState<string[]>(parseHash());

  useEffect(() => {
    const onChange = () => setParts(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [parts.join('/')]);

  let page;
  if (parts.length === 0) {
    page = <HomePage />;
  } else if (parts.length === 1) {
    page = <ReviewQueue category={parts[0]} />;
  } else if (parts[1] === 'quiz') {
    page = <CardView category={parts[0]} />;
  } else if (parts[1] === 'browse') {
    page = <ModuleNav category={parts[0]} />;
  } else {
    page = <ReviewQueue category={parts[0]} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed top-4 right-4 z-50">
        <ModeToggle />
      </div>
      <div className="mx-auto max-w-3xl px-4 py-8">{page}</div>
    </div>
  );
}
```

删除 `App.jsx`。

⚠️ 此时 import 的组件(HoMePage/ReviewQueue 等)还没迁完——会报错。可先注释掉路由内容,返回 null,下个 task 逐个补。或先建空的占位组件文件。**推荐:先建空占位导出,让 App 能编译。**

- [ ] **Step 3: 建空占位组件(让 App 能编译)**

临时在对应文件建空导出(后续 task 填充):
```tsx
// home-page.tsx, review-queue.tsx, card-view.tsx, module-nav.tsx, mode-toggle.tsx
export function XxxPage() { return null; }
```

- [ ] **Step 4: 验证 + Commit**

Run: `npm run typecheck && npm run build`
Expected: 通过(页面空白但能跑)。

```bash
git add -A
git commit -m "feat(quiz-app): 重写 main.tsx/App.tsx,接入 ThemeProvider + 路由骨架"
```

---

## Task 8: 迁移 ModeToggle(主题切换)

**Files:**
- `quiz-app/src/components/mode-toggle.tsx`

- [ ] **Step 1: 实现 ModeToggle**

```tsx
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/theme';

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>浅色</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>深色</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>跟随系统</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: 浏览器验证**

Run: `npm run dev`,点右上角图标,切换浅色/深色/系统,确认页面颜色变化、刷新后记忆(localStorage `quiz-theme`)。

- [ ] **Step 3: Commit**

```bash
git add src/components/mode-toggle.tsx
git commit -m "feat(quiz-app): 主题切换组件(深色/浅色/跟随系统)"
```

---

## Task 9: 迁移 HomePage(首页介绍)

**Files:**
- `quiz-app/src/components/home-page.tsx`

- [ ] **Step 1: 实现 HomePage**

读现有 `CategoryList.jsx`(了解分类数据怎么展示),然后实现首页:

```tsx
import { Link } from 'react-router-dom'; // ❌ 不引路由库,用 hash 链接
```

**修正**:不用 react-router,用 `<a href="#/agent">`。实现:

```tsx
import { useQuestions } from '@/lib/questions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  { title: '间隔重复', desc: 'SM-2 算法,不会的题反复出现,掌握的题逐渐淡出' },
  { title: 'WYSIWYG 笔记', desc: '每题可写笔记,所见即所得,本地存储' },
  { title: '强制思考', desc: '答案默认折叠,先想清楚再对答案' },
  { title: '深浅双主题', desc: '深色/浅色/跟随系统,护眼任选' },
];

export function HomePage() {
  const { data } = useQuestions();
  const cats = data?.categories ?? [];

  return (
    <div className="space-y-10">
      <div className="space-y-4 text-center pt-8">
        <h1 className="text-4xl font-bold tracking-tight">
          前端转 <span className="text-primary">AI Agent</span> 面试刷题
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          间隔重复刷面试题,边刷边写笔记。覆盖前端工程师与 AI Agent 工程师方向。
        </p>
        <div className="flex gap-3 justify-center pt-2">
          {cats.map((c) => (
            <Button asChild key={c.slug} size="lg">
              <a href={`#/${c.slug}`}>{c.name}（{c.count} 题）</a>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-lg">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>数据本地存储,不上传服务器。纯前端,开源。</p>
        <p>题库以 YAML 为源,社区共建。 github.com/starlibaixing-coder/resume-assistant</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 浏览器验证**

打开 `#/`,确认首页渲染、入口按钮跳转正确、特点卡片展示。

- [ ] **Step 3: Commit**

```bash
git add src/components/home-page.tsx
git commit -m "feat(quiz-app): 首页介绍页(定位 + 题库入口 + 特点)"
```

---

## Task 10: 迁移 ReviewQueue(分类入口 + 清除进度)

**Files:**
- `quiz-app/src/components/review-queue.tsx`

这是最复杂的迁移之一——原 ReviewQueue 逻辑 + 新增清除进度两按钮。

- [ ] **Step 1: 读现有 ReviewQueue.jsx 完整逻辑**

读 `quiz-app/src/components/ReviewQueue.jsx`,理解:队列概览、题量选择(20/50/100/全部)、开始按钮、模块浏览入口。这些逻辑**全部保留**,只换外壳。

- [ ] **Step 2: 迁移到 review-queue.tsx**

保留原有逻辑(队列计算、URL 参数 limit、跳转),用 shadcn Card/Button/Progress 重写外壳。**底部新增清除进度区**:

```tsx
// 底部清除区(在 return 的最下方)
<div className="flex gap-2 pt-4 border-t border-border">
  <ClearProgressButton category={category} onCleared={() => window.location.reload()} />
  <ClearNotesButton category={category} onCleared={() => window.location.reload()} />
</div>
```

`ClearProgressButton` / `ClearNotesButton` 用 shadcn Dialog 做二次确认:

```tsx
import { clearProgress, clearNotes } from '@/lib/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function ClearProgressButton({ category, onCleared }: { category: string; onCleared: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          清空复习进度
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>清空复习进度?</DialogTitle>
          <DialogDescription>
            将删除「{category}」分类的全部刷题进度(SM-2 记录)。笔记会保留。此操作不可恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => { clearProgress(category); onCleared(); }}>
            确认清空
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ClearNotesButton 同理,调 clearNotes,描述改成"笔记"
```

⚠️ ReviewQueue 主体逻辑(队列、题量、跳转)必须从原 .jsx 原样搬来,这是骨架。外壳用 shadcn。

- [ ] **Step 3: 浏览器验证**

`#/agent`:队列概览、开始刷题、题量选择、模块浏览都正常。底部两个清除按钮,点开二次确认,确认后进度/笔记被清。

- [ ] **Step 4: Commit**

```bash
git add src/components/review-queue.tsx
git commit -m "feat(quiz-app): ReviewQueue 迁移 TS + shadcn,加清除进度两按钮"
```

---

## Task 11: 迁移 AnswerPanel

**Files:**
- `quiz-app/src/components/answer-panel.tsx`

- [ ] **Step 1: 迁移**

读现有 `AnswerPanel.jsx`,迁移到 TSX。用 Tailwind 排版,答案 markdown 用 prose:

```tsx
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

export function AnswerPanel({ answer, followups }: { answer: string[]; followups: string[] }) {
  return (
    <div className="border-t border-border pt-5 mt-2 space-y-3">
      <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
        参考答案要点
      </div>
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(answer.join('\n')) }}
      />
      {followups.length > 0 && (
        <>
          <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">
            追问方向
          </div>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {followups.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
```

prose 类需要 `@tailwindcss/typography` 插件。在 index.css 加:
```css
@plugin "@tailwindcss/typography";
```
并安装:`npm install -D @tailwindcss/typography`

- [ ] **Step 2: Commit**

```bash
git add src/components/answer-panel.tsx src/index.css package.json package-lock.json
git commit -m "feat(quiz-app): AnswerPanel 迁移 TSX + Tailwind typography"
```

---

## Task 12: 迁移 NotePanel(Tiptap 懒加载)

**Files:**
- `quiz-app/src/components/note-panel.tsx`

保留 Tiptap WYSIWYG 逻辑,改用 Tailwind 类,导出 default(供 lazy)。

- [ ] **Step 1: 读现有 NotePanel.jsx 逻辑**

读 `quiz-app/src/components/NotePanel.jsx`,理解:外层 key 切题重建、useState 惰性初始化读笔记、useEditor + StarterKit、onUpdate 防抖保存、immediatelyRender: false、收起态入口。**这些逻辑全保留**。

- [ ] **Step 2: 迁移到 note-panel.tsx**

逻辑原样保留,外壳 className 换成 Tailwind,ProseMirror 样式用任意值变体:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getNote, saveNote } from '@/lib/storage';
import { cn } from '@/lib/utils';

// 注意:default export(lazy 需要)
export default function NotePanel({ category, questionId }: { category: string; questionId: string }) {
  return <NotePanelEditor key={questionId} category={category} questionId={questionId} />;
}

function NotePanelEditor({ category, questionId }: { category: string; questionId: string }) {
  // ... 原有逻辑全部保留(useState 惰性初始化、useEditor、onUpdate、immediatelyRender:false、收起态)
  // className 换成 Tailwind:
  // - .note-panel -> "mt-4 p-3.5 bg-card border border-border rounded-lg"
  // - .note-collapsed -> "p-0 bg-transparent border-none"
  // - .note-entry-btn -> "w-full px-3 py-2 bg-transparent border border-dashed border-border rounded-md text-muted-foreground hover:border-primary hover:text-primary transition-colors"
  // - .note-editor-wrap -> "bg-popover border border-border rounded-md overflow-hidden focus-within:border-primary transition-colors"
  // - ProseMirror 区域用任意值变体:
  //   EditorContent className="[&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:max-h-[320px] [&_.ProseMirror]:overflow-y-auto [&_.ProseMirror]:p-3 [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-[13px] [&_.ProseMirror]:leading-relaxed"
}
```

⚠️ ProseMirror 内部元素(p/strong/code/ul 等)的样式,用 `@tailwindcss/typography` 的 prose 更省事:
```tsx
<EditorContent editor={editor} className="note-editor-wrap prose prose-sm dark:prose-invert" />
```
但 ProseMirror 的 editable 区域和 prose 配合需测试。若 prose 干扰编辑,回退到手写任意值变体。

- [ ] **Step 3: 在 CardView/ModuleNav 里用 lazy 引用**

(在 Task 13/14 迁移 CardView/ModuleNav 时做):
```tsx
import { lazy, Suspense } from 'react';
const NotePanel = lazy(() => import('./note-panel'));
// 使用处:
<Suspense fallback={<div className="text-muted-foreground text-sm">加载笔记…</div>}>
  <NotePanel category={category} questionId={id} />
</Suspense>
```

- [ ] **Step 4: 浏览器验证**

笔记 WYSIWYG 工作、保存、切题 flush、收起态入口。

- [ ] **Step 5: Commit**

```bash
git add src/components/note-panel.tsx
git commit -m "feat(quiz-app): NotePanel 迁移 TSX + Tailwind(default export 供 lazy)"
```

---

## Task 13: 迁移 CardView(复习流 + Tiptap 懒加载)

**Files:**
- `quiz-app/src/components/card-view.tsx`

- [ ] **Step 1: 读现有 CardView.jsx 完整逻辑**

理解:队列 useMemo、revealed 状态、强制思考、答案展开/收起、三档评分、handleRate/handleNextRound、DoneState/RoundDoneState。**全保留**。

- [ ] **Step 2: 迁移到 card-view.tsx**

逻辑原样,外壳换 shadcn + Tailwind:
- 难度/标签用 Badge
- 按钮用 Button
- NotePanel 用 lazy + Suspense
- 答案区用 AnswerPanel 组件
- 收起按钮(Task 上次加的)保留

这是最大组件,仔细迁移。

- [ ] **Step 3: 浏览器验证**

`#/agent/quiz`:强制思考、看答案、收起答案、评分切题、笔记懒加载(首屏无 Tiptap chunk)、Done 状态。

- [ ] **Step 4: Commit**

```bash
git add src/components/card-view.tsx
git commit -m "feat(quiz-app): CardView 迁移 TSX + shadcn,NotePanel 懒加载"
```

---

## Task 14: 迁移 ModuleNav(浏览模式)

**Files:**
- `quiz-app/src/components/module-nav.tsx`

- [ ] **Step 1: 读现有 ModuleNav.jsx 完整逻辑**

理解:模块分组、筛选条(all/unmastered/due/high)、展开/收起、模块统计、进度条。**全保留**。

- [ ] **Step 2: 迁移到 module-nav.tsx**

逻辑原样,外壳换 shadcn + Tailwind。NotePanel 用 lazy + Suspense。

- [ ] **Step 3: 浏览器验证**

`#/agent/browse`:模块列表、筛选、展开题目、答案、笔记、与复习流数据互通。

- [ ] **Step 4: Commit**

```bash
git add src/components/module-nav.tsx
git commit -m "feat(quiz-app): ModuleNav 迁移 TSX + shadcn"
```

---

## Task 15: 清理 + 全量验证

**Files:** 删除残留旧文件

- [ ] **Step 1: 删除所有旧 .jsx/.js 源文件**

```bash
cd quiz-app
# 确认 src 下无 .jsx/.js(全已迁 .tsx/.ts)
find src -name "*.jsx" -o -name "*.js"
# 若有残留,删除(确认是已迁移的旧文件)
```

删除 CategoryList.jsx(被 HomePage 取代)。

- [ ] **Step 2: 删除 index.html 里对 main.jsx 的旧引用**

读 `quiz-app/index.html`,确认 `<script src="/src/main.tsx">`(不是 main.jsx)。

- [ ] **Step 3: 全量校验**

```bash
npm run build:bank    # 题库不变
npm run typecheck     # TS 零错误
npm run build         # Vite 构建通过
```

- [ ] **Step 4: 浏览器全流程手测**

`npm run dev`,测:
1. 首页(`#/`)渲染、入口跳转
2. 主题三档切换 + 刷新记忆
3. 切换主题后所有页面颜色正确(重点查:有无硬编码颜色漏色)
4. 复习流:强制思考/答案展开收起/评分切题/笔记
5. 浏览模式:筛选/展开/笔记互通
6. 清进度:进度归零、笔记还在
7. 清笔记:笔记没了、进度还在
8. DevTools Network:首屏 chunk 不含 tiptak(Tiptap 懒加载)

- [ ] **Step 5: 最终 commit**

```bash
git add -A
git commit -m "chore(quiz-app): 清理旧 jsx 残留,现代化重构完成"
```

---

## Self-Review(计划自审)

**1. Spec 覆盖:**
- §1 整体架构(React19/Vite7/TS/Tailwind4/shadcn/别名/目录)→ Task 1-2 ✅
- §2 Tailwind token 体系(暖橙/深浅/语义色)→ Task 3 ✅
- §3 类型 + lib TS 迁移(key 不变)→ Task 4-5 ✅
- §4 组件迁移(路由/HomePage/ReviewQueue/CardView/ModuleNav/AnswerPanel/NotePanel 懒加载)→ Task 7-14 ✅
- §5 主题切换/清除进度/验证 → Task 8/10/15 ✅
- Tiptap 懒加载 → Task 12(lazy export)+ Task 13/14(Suspense 引用)✅

**2. Placeholder 扫描:**
- "读现有 X.jsx 理解逻辑" 是真实的指令(现有文件存在),不是占位。但 sm2.ts/schedule.ts 我给了示意代码而非完整——**这是真实的限制**:现有算法逻辑必须从文件读,我标注了"⚠️ 必须先读核对"。执行时 subagent 会读。可接受。
- 无 TBD/TODO。✅

**3. 类型一致性:**
- `CardState` (sm2.ts) ↔ storage.ts(saveCard 参数) ↔ schedule.ts(loadProgress 返回)✅
- `Rating` = '不会'|'模糊'|'掌握' (question.ts) ↔ sm2.ts(review 参数) ↔ CardView(handleRate)✅
- `Question`/`Category`/`QuestionData` (question.ts) ↔ questions.ts(useQuestions 返回)✅
- `Theme` (theme.tsx) ↔ ModeToggle(setTheme 参数)✅
- `clearProgress`/`clearNotes` (storage.ts) ↔ ReviewQueue(清除按钮)✅
- localStorage keys: `quiz-progress:` / `quiz-notes-v2:` / `quiz-theme` 全程一致 ✅

**4. 风险点:**
- shadcn CLI 在 npm/npx 下可能有问题 → Task 6 给了手动拷贝回退 ✅
- Tiptap ProseMirror + prose 插件配合 → Task 12 给了回退方案(任意值变体)✅
- React 19 API 变化 → 逐组件验证 ✅
- marked.parse 返回类型 → Task 5 用 `as string` ✅
