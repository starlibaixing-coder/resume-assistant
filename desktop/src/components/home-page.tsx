import { useEffect, useState } from 'react';
import { useQuestions } from '@/lib/questions';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Button } from '@/components/ui/button';

// 用户价值,不是术语。每条 = 一个加粗的钩子 + 一句具体的解释。
const VALUES: { tag: string; hook: string; desc: string }[] = [
  {
    tag: '记忆',
    hook: '不会的题,自动反复出现',
    desc: '会的逐渐淡出,不会的反复回来。刷过的题不轻易忘——不是看一遍就丢。',
  },
  {
    tag: '思考',
    hook: '答案先藏起来,逼你想',
    desc: '默认折叠。先在脑子里过一遍,再对答案。记的是思路,不是答案的形状。',
  },
  {
    tag: '笔记',
    hook: '每题能写笔记,边刷边记',
    desc: '所见即所得,刷新不丢。你的理解跟着题目走,不是散落在别处的文档。',
  },
  {
    tag: '本地',
    hook: '进度、笔记、我的题,全存本地',
    desc: '官方题库只读共享;你刷的进度和 AI 生成的题存本地 SQLite,不上传、不追踪。',
  },
];

export function HomePage() {
  const { data } = useQuestions();
  // my 分类走下方专属卡片(带空态引导),聚合数据里的不重复渲染
  const cats = (data?.categories ?? []).filter((c) => c.slug !== 'my');
  // 我的库状态(草稿数/我的题库卡片)独立订阅,官方聚合未变时也要随 mylib 刷新
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  return (
    <div className="mx-auto max-w-3xl px-1 py-6 sm:py-8">
      {/* ── Hero ─────────────────────────────────────── */}
      <header className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          面试题,刷到<span className="text-primary">真的记住</span>
        </h1>

        <p className="max-w-xl text-base text-muted-foreground">
          面向前端工程师,以及前端背景想转 AI Agent 的人。
        </p>

        {/* 工具入口:生题 / 草稿区 / 设置 */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-sm">
          <a href="#/generate" className="text-primary hover:underline font-medium">✦ AI 生题</a>
          <a
            href="#/drafts"
            className={pendingCount > 0 ? 'text-warning hover:underline font-medium' : 'text-muted-foreground hover:text-primary'}
          >
            草稿区{pendingCount > 0 ? `(${pendingCount})` : ''}
          </a>
          <a href="#/settings" className="text-muted-foreground hover:text-primary">设置</a>
        </div>

        {/* 两个方向入口 -- 唯一的入口,带说明 */}
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
          {cats.map((c) => (
            <a
              key={c.slug}
              href={`#/${c.slug}`}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold text-foreground">{c.name}</span>
                <span className="font-mono text-sm text-primary">
                  {c.count}
                  <span className="ml-0.5 text-xs text-muted-foreground">题</span>
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                {c.description}
              </p>
              <span className="font-mono text-xs text-muted-foreground">
                {c.modules?.length ?? 0} 个模块
                <span className="ml-2 text-primary opacity-0 transition-opacity group-hover:opacity-100">开始 →</span>
              </span>
            </a>
          ))}

          {/* 我的题库(双库并列,ADR-3):AI 生成 + 官方副本 */}
          <a
            href={myCategory.count > 0 ? '#/my' : '#/generate'}
            className="group flex flex-col gap-2 rounded-lg border border-dashed border-border bg-card/50 p-4 transition-colors hover:border-primary"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-foreground">我的题库</span>
              <span className="font-mono text-sm text-primary">
                {myCategory.count}
                <span className="ml-0.5 text-xs text-muted-foreground">题</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {myCategory.count > 0
                ? `AI 生成 + 官方副本 · ${myCategory.modules.length} 个批次`
                : '还是空的——去 AI 生题,或把官方题复制过来改'}
            </p>
            <span className="font-mono text-xs text-muted-foreground">
              本地 SQLite,与官方库并列
              <span className="ml-2 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                {myCategory.count > 0 ? '开始 →' : '去生题 →'}
              </span>
            </span>
          </a>
        </div>
      </header>


      {/* ── 价值 —— 说人话 ─────────────────────────── */}
      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">特点</h2>

        <ul className="divide-y divide-border border-y border-border">
          {VALUES.map((v, i) => (
            <li
              key={v.tag}
              className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-1 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs uppercase tracking-wide text-primary">
                  {v.tag}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{v.hook}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 价值列表的「本地」条已经说了数据存储,无需 footer 重复 */}
    </div>
  );
}
