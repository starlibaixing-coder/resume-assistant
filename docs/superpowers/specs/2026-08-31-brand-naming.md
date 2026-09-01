# 品牌与命名规范(CommitCareer)

- **日期**:2026-08-31
- **性质**:用户指示的菜单/页面标题/App 名与图标重设计,决策经确认(产品名 CommitCareer、橙色闪电图标、菜单重排+改名)。

## 决策

### 产品名:CommitCareer

四处统一:窗口标题(tauri.conf `windows[0].title`)、productName、侧栏品牌、动态 `document.title`(跟随路由 `页面 · CommitCareer`,实现于 app-shell)。bundle identifier `com.resume-assistant.desktop` 不变(日志路径/数据目录不受影响)。

### App 图标

深色圆角方块(`.dark --background` token 色)+ 品牌橙闪电(`--primary` 系),发丝描边呼应深色边框层级。源稿 `/tmp` 一次性生成,产物为 `src-tauri/icons/` 全套(tauri icon 从 1024 PNG 生成);如需改版:改 SVG 源 → playwright 渲染 1024 → `npx tauri icon`。

### 侧栏信息架构(顺序 = 频率 × 工作流)

```
品牌 CommitCareer
总览
【刷题】  官方分类… / 我的题库      ← 高频入口提前
【求职】  求职中枢 → 出题 → 待审核  ← 生成工作流顺序
(底部)设置
```

### 命名表(UI 文案以此为准;路由/表名不变)

| 旧 | 新 | 备注 |
|---|---|---|
| 刷题 Agent | CommitCareer | 品牌四处统一 |
| 生题(菜单/页面标题) | 出题 | 覆盖 AI+手动;页内 tab「AI 生题/手动加题」保留更具体的说法 |
| 草稿区(菜单/页面标题) | 待审核 | 功能优先;ADR-10 术语「草稿区/pending」在文档与代码中保留 |
| 题库分类(节标题) | 刷题(节)+ 新增 求职(节) | 分组语义 |
| 去生题 / 存入草稿区 | 去出题 / 提交审核 | 动作文案跟随 |
| `{分类名} / 题目浏览` | `{分类名} · 题目浏览` | 子页统一中点风格 |
| 队列页裸分类名 | `{分类名} · 刷题队列` | 同上 |
| 文内「先进草稿区,通过后…」 | 「先进待审核,通过后…」 | 说明文字跟随 |

不变的:路由(`/generate` `/drafts` `/profile`)、questions 表 `status='pending'`、文档中 ADR-10 草稿区概念名、`去刷题`/`手动加题`/`定向生题`(作为动作动词保留)。
