# 刷题站现代化重构设计(TS + Tailwind v4 + shadcn + 主题 + 首页)

- **日期**:2026-08-06
- **范围**:`quiz-app/` 全站重构
- **目标**:引入 TypeScript + Tailwind v4 + shadcn/ui,加主题切换、清除进度、首页介绍。保持现有全部功能(SM-2 刷题、强制思考、WYSIWYG 笔记、答案展开收起、浏览模式),数据零迁移。

## 背景与动机

现有 quiz-app 是纯 JSX(896 行 / 9 文件)+ 手写 CSS(700 行),无 TS、无 Tailwind。问题:① 无类型,后期扩展难;② 手写 CSS 维护成本高;③ 只有深色主题;④ 无清除进度入口(localStorage 数据清不掉);⑤ 打开即分类列表,缺功能介绍。

用户要求一次性完成:TS 全量迁移 + Tailwind/shadcn + 主题三选一 + 清除进度(两按钮) + 首页。Tiptap 保留但懒加载。

## 需求(已与用户确认)

1. **TS 全量迁移**:全量迁 .tsx/.ts,加完整类型(数据接口、组件 props、lib 函数)
2. **Tailwind v4 + shadcn/ui**:替换手写 CSS,用语义化 token + shadcn 组件
3. **主题三选一**:深色 / 浅色 / 跟随系统,localStorage 记忆(localStorage key `quiz-theme`)
4. **清除进度**:两个独立按钮(清复习进度 / 清笔记),各带二次确认,放分类入口页底部
5. **首页**:介绍页(功能/面向用户/特点) + 两个题库入口按钮
6. **Tiptap**:保留 WYSIWYG,用 React.lazy 懒加载,首屏不加载
7. **React 18 → 19 升级**(shadcn 最新组件库对 19 支持最好,趁重构一起升)

## 设计

### §1 整体架构

**技术栈升级**:
- React 18.3 → 19
- Vite 5 → 7(skill 基于 v7,shadcn 兼容性最好)
- 新增:TypeScript 5、tailwindcss 4、@tailwindcss/vite、clsx、tailwind-merge、lucide-react、@radix-ui/* (shadcn 依赖)
- 现有保留:@tiptap/react、@tiptap/starter-kit、js-yaml、marked

**Tailwind v4 四步架构**(skill 强制,详见 tailwind-v4-shadcn skill):
1. `:root` 和 `.dark` 定义 CSS 变量(值包 `hsl()`)
2. `@theme inline` 映射变量到 Tailwind 工具类(`bg-background` 等)
3. `@layer base` 用未包装变量
4. 删 `tailwind.config.ts`(v4 不用),用 `@tailwindcss/vite` 插件

**路径别名**:`@/` → `src/`(tsconfig + vite 双配置)

**目录结构**(重构后):
```
quiz-app/src/
├── main.tsx                    # 入口,包 ThemeProvider
├── App.tsx                     # 路由
├── index.css                   # Tailwind v4 + shadcn token(重写)
├── vite-env.d.ts               # TS 环境声明
├── lib/
│   ├── utils.ts                # cn() 工具(clsx + tailwind-merge)
│   ├── questions.ts            # 数据加载 hook
│   ├── sm2.ts                  # 间隔重复算法
│   ├── schedule.ts             # 队列调度
│   ├── storage.ts              # localStorage(progress + notes)
│   ├── markdown.ts             # marked 封装
│   └── theme.tsx               # 主题 context(ThemeProvider + useTheme)
├── components/
│   ├── ui/                     # shadcn 生成的基础组件
│   ├── home-page.tsx           # 新:首页介绍 + 入口(取代原 CategoryList)
│   ├── review-queue.tsx        # 分类入口(含清除进度按钮)
│   ├── card-view.tsx           # 复习流
│   ├── module-nav.tsx          # 浏览模式
│   ├── answer-panel.tsx        # 答案+追问
│   └── note-panel.tsx          # Tiptap 笔记(lazy)
└── types/
    └── question.ts             # 题库数据接口
```

### §2 Tailwind v4 + shadcn 主题体系

**CSS 变量映射**(现有自定义变量 → shadcn 语义化 token):

| 现有变量 | shadcn token | 用途 |
|---------|-------------|------|
| `--bg` | `--background` | 页面底色 |
| `--bg-elev` | `--card` | 卡片/面板背景 |
| `--bg-card` | `--popover` | 弹层/输入框底 |
| `--border` | `--border` | 边框 |
| `--text` | `--foreground` | 主文字 |
| `--text-dim` / `--text-mute` | `--muted-foreground` | 次文字/占位 |
| `--accent`(暖橙 #e8825a) | `--primary` | 主强调色(品牌色) |
| `--good` | `--success`(自定义语义色) | 成功/掌握 |
| `--warn` | `--warning`(自定义语义色) | 待复习 |
| `--bad` | `--destructive` | 错误/不会 |

**保留暖橙品牌色**作为 `--primary`(shadcn 默认黑白/蓝,token 化后任何颜色都行)。深色模式沿用现有深色调,浅色模式新增一套(背景白、文字深灰、强调色用同款橙调亮)。

**index.css 结构**(严格按 skill 四步):
- `@import "tailwindcss"`
- `:root`(浅色 token,值包 `hsl()`)
- `.dark`(深色 token)
- `@theme inline`(映射变量到工具类)
- `@layer base`(body 基础样式)

**自定义语义色**(success/warning)需在 `@theme inline` 里加映射:
```css
@theme inline {
  --color-success: var(--success);
  --color-warning: var(--warning);
}
```

**shadcn 组件**(按需装,不装全):button、card、dialog、dropdown-menu、badge、progress、separator、textarea(备用)

**cn() 工具**(`src/lib/utils.ts`):clsx + tailwind-merge,所有条件 className 用它。

### §3 数据类型与 lib 层 TS 迁移

**类型定义**(`src/types/question.ts`,对应 build.mjs 输出):
```ts
export interface Question {
  id: string; category: string; module: number; moduleName: string;
  index: number; type: 'qa';
  difficulty: '初' | '中' | '高';
  tags: string[]; title: string; focus: string;
  answer: string[]; followups: string[];
}
export interface Category {
  slug: string; name: string; description: string;
  modules: { id: number; name: string; count: number }[];
  count: number;
}
export interface QuestionData {
  categories: Category[]; questions: Question[]; total: number;
}
```

**lib 层迁移**(6 文件,签名 + 内部加类型):
- `questions.ts`:`useQuestions(): { data: QuestionData | null; error: string | null }`
- `sm2.ts`:`CardState` 接口、`review(card, rating)`,`rating: '不会'|'模糊'|'掌握'`
- `schedule.ts`:`ModuleStats`、`QuestionStatus = 'unseen'|'due'|'learning'|'mastered'`
- `storage.ts`:签名加类型,**localStorage key 不变**(`quiz-progress:` / `quiz-notes-v2:`),数据零迁移
- `markdown.ts`:`renderMarkdown(text: string): string`
- `theme.tsx`:`type Theme = 'light'|'dark'|'system'`

### §4 UI 组件迁移(JX → TSX + shadcn)

**路由**:
| 路由 | 组件 | 说明 |
|------|------|------|
| `#/` | `<HomePage/>` | 新:介绍 + 两个题库入口 |
| `#/<cat>` | `<ReviewQueue/>` | 分类入口(含清除按钮) |
| `#/<cat>/quiz` | `<CardView/>` | 复习流 |
| `#/<cat>/browse` | `<ModuleNav/>` | 浏览模式 |

**HomePage(新)**:
- Hero:一句话定位("前端转 AI Agent 面试刷题")+ 两个大按钮(前端 / AI Agent)
- 特点区:3-4 卖点(间隔重复 / WYSIWYG 笔记 / 强制思考 / 本地存储)
- 数据源说明
- 顶部右侧:主题切换

**ReviewQueue**:逻辑保留,卡片用 shadcn Card,按钮用 Button,进度条用 Progress。**底部加两个清除按钮**(ghost 风格),各带 Dialog 二次确认。

**CardView**(最复杂):
- 保留:强制思考、答案展开/收起、三档评分、笔记、切题
- 难度/标签用 Badge
- 答案 markdown 用 `@tailwindcss/typography` 的 `prose prose-sm`(替代 `.md-body`)
- **NotePanel 懒加载**:`const NotePanel = lazy(() => import('./note-panel'))`,外包 Suspense

**ModuleNav**:展开/收起、筛选条、模块统计保留;筛选按钮用 Button。

**AnswerPanel**:用 `prose prose-sm` 排版。

**NotePanel**:WYSIWYG + 防抖保存 + 切题 flush 全保留;ProseMirror 样式改 Tailwind 类;导出 default(懒加载需要)。

**全局**:
- **ThemeProvider**(shadcn 标准):包 main.tsx 最外层,`defaultTheme="dark"` `storageKey="quiz-theme"`
- **ModeToggle**:右上角图标按钮,dropdown 三选,用 lucide Sun/Moon

### §5 主题切换、清除进度、验证

**主题切换**:
- ThemeProvider 包最外层
- ModeToggle:lucide Sun/Moon 图标按钮,dropdown 三选
- "跟随系统"监听 `prefers-color-scheme`
- 通过给 `<html>` 加/去 `.dark` class 实现

**清除进度**(ReviewQueue 底部):
```
┌─────────────────────────────────┐
│  分类入口内容...                 │
│  已学 12/135 · 待复习 3          │
├─────────────────────────────────┤
│  [清空复习进度]  [清空笔记]      │
└─────────────────────────────────┘
```
- 点按钮 → shadcn Dialog 二次确认("确定清空...?此操作不可恢复")
- 调 `clearProgress(cat)` 或 `clearNotes(cat)`,清完刷新统计
- 两按钮独立:清进度不动笔记,清笔记不动进度

**验证**(无测试框架,沿用既有约定):
1. `npm run build:bank` 通过(题库数据不变)
2. `tsc --noEmit` 通过(TS 类型零错误)
3. `npm run build` 通过(Vite 生产构建)
4. 浏览器手测:
   - 首页渲染、入口按钮跳转
   - 主题三档切换 + 刷新记忆
   - 主题切换后所有页面颜色正确(无硬编码漏色)
   - 清进度:进度归零、笔记还在
   - 清笔记:笔记没了、进度还在
   - Tiptap 懒加载:首屏不含 Tiptap chunk
   - 复习流/浏览所有原有功能正常

## 不做的事(YAGNI)

- **不改 localStorage key**:`quiz-progress:` / `quiz-notes-v2:` 保持,数据零迁移
- **不改 SM-2 算法**:间隔重复逻辑不动
- **不改题库数据**:build.mjs / banks / questions.json 不动
- **不引路由库**:继续用现有 hash 路由(手写),不引 react-router
- **不装全 shadcn 组件**:只装用到的
- **不做 i18n / 账号 / 后端**:保持纯前端

## 涉及文件清单

**新增**:
- `quiz-app/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`
- `quiz-app/components.json`(shadcn 配置)
- `quiz-app/src/types/question.ts`
- `quiz-app/src/lib/utils.ts`
- `quiz-app/src/lib/theme.tsx`
- `quiz-app/src/components/ui/*`(shadcn 生成)
- `quiz-app/src/components/home-page.tsx`
- `quiz-app/src/components/mode-toggle.tsx`
- `quiz-app/src/vite-env.d.ts`

**重写**(JSX→TSX / 手写 CSS→Tailwind):
- `quiz-app/src/main.jsx` → `main.tsx`
- `quiz-app/src/App.jsx` → `App.tsx`
- `quiz-app/src/index.css`(全重写为 Tailwind v4 + token)
- `quiz-app/src/lib/*` 6 个文件(.js → .ts/.tsx)
- `quiz-app/src/components/*` 6 个组件(.jsx → .tsx)。注:CategoryList 被 HomePage 取代,删除。
- `quiz-app/vite.config.js` → `vite.config.ts`

**配置修改**:
- `quiz-app/package.json`(依赖增删、scripts 加 tsc)
- `quiz-app/package-lock.json`(重新生成)

## 风险与对策

- **Tailwind v4 的坑**:严格按 skill 的四步架构 + checklist,已知坑(tw-animate-css、重复 @layer、tailwind.config.ts 残留)主动规避
- **React 19 升级**:可能有 API 变化,逐组件迁移时验证
- **bundle 体积**:Tiptap 懒加载保证首屏不含;React 19 比 18 略小
- **工作量大**:拆成细粒度 plan,逐步执行逐步验证,每步可回滚
