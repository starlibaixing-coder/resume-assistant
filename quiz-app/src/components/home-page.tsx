import { useQuestions } from '@/lib/questions';
import { Button } from '@/components/ui/button';

// GitHub 官方 logo(lucide 已移除品牌图标,用内联 SVG)
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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
    hook: '进度和笔记只存你浏览器',
    desc: '不上传,不联网,不追踪。清缓存才没——你的数据真的是你的。',
  },
];

export function HomePage() {
  const { data } = useQuestions();
  const cats = data?.categories ?? [];
  const total = data?.total ?? 282;
  const moduleCount = cats.reduce((sum, c) => sum + (c.modules?.length ?? 0), 0) || 34;

  return (
    <div className="mx-auto max-w-3xl px-1 py-12 sm:py-16">
      {/* ── Hero ─────────────────────────────────────── */}
      <header className="space-y-5">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          面试题,刷到<span className="text-primary">真的记住</span>
        </h1>

        <p className="max-w-xl text-base text-muted-foreground">
          面向前端工程师,以及前端背景想转 AI Agent 的人。间隔重复 + 笔记,不是看一遍就过的题库。
        </p>

        {/* 两个方向入口 —— 唯一的入口,带说明 */}
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
        </div>
      </header>

      {/* ── Stats ────────────────────────────────────── */}
      <section className="mt-12 border-y border-border py-4">
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-xl font-semibold text-foreground">{total}</dt>
            <dd className="text-muted-foreground">题</dd>
          </div>
          <span className="text-border">·</span>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-xl font-semibold text-foreground">{cats.length || 2}</dt>
            <dd className="text-muted-foreground">个方向</dd>
          </div>
          <span className="text-border">·</span>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-xl font-semibold text-foreground">{moduleCount}</dt>
            <dd className="text-muted-foreground">个知识模块</dd>
          </div>
        </dl>
      </section>

      {/* ── 价值 —— 说人话 ─────────────────────────── */}
      <section className="mt-12 space-y-5">
        <h2 className="text-sm font-medium text-muted-foreground">特点</h2>

        <ul className="divide-y divide-border border-y border-border">
          {VALUES.map((v, i) => (
            <li
              key={v.tag}
              className="grid grid-cols-[3rem_1fr] gap-x-4 gap-y-1 py-4"
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

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="mt-14 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>纯前端,开源。数据只存你的浏览器。</p>
        <a
          href="https://github.com/starlibaixing-coder/resume-assistant"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
        >
          <GithubIcon className="h-4 w-4" />
          <span className="font-mono">GitHub</span>
        </a>
      </footer>
    </div>
  );
}
