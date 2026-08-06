import { useQuestions } from '@/lib/questions';
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
    hook: '进度和笔记只存你浏览器',
    desc: '不上传,不联网,不追踪。清缓存才没——你的数据真的是你的。',
  },
];

export function HomePage() {
  const { data } = useQuestions();
  const cats = data?.categories ?? [];
  const total = data?.total ?? 282;
  const moduleCount = cats.reduce((sum, c) => sum + (c.modules?.length ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-1 py-12 sm:py-16">
      {/* ── Hero ─────────────────────────────────────── */}
      <header className="space-y-6">
        <p className="font-mono text-xs tracking-wide text-muted-foreground">
          // 刷题,不是看题
        </p>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          把面试题
          <br />
          刷进{' '}
          <span className="text-primary">长期记忆</span>
        </h1>

        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          面向前端工程师,以及前端背景想转{' '}
          <span className="font-medium text-foreground">AI Agent</span>{' '}
          的人。不是又一个只让你"过一遍"的题库。
        </p>

        {/* 两个方向入口 —— hash 路由,必须用 <a> */}
        <div className="flex flex-wrap gap-3 pt-2">
          {cats.map((c, i) => (
            <Button asChild size="lg" key={c.slug} className="group h-auto py-3">
              <a href={`#/${c.slug}`}>
                <span className="font-mono text-xs text-primary-foreground/70">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-base">{c.name}</span>
                <span className="font-mono text-xs text-primary-foreground/80">
                  {c.count}题
                </span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
            </Button>
          ))}
        </div>
      </header>

      {/* ── Stats ────────────────────────────────────── */}
      <section className="mt-14 border-y border-border py-5">
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-2xl font-semibold text-foreground">{total}</dt>
            <dd className="text-muted-foreground">题</dd>
          </div>
          <span className="text-border">·</span>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-2xl font-semibold text-primary">2</dt>
            <dd className="text-muted-foreground">个方向</dd>
          </div>
          <span className="text-border">·</span>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-2xl font-semibold text-foreground">{moduleCount || 34}</dt>
            <dd className="text-muted-foreground">个知识模块</dd>
          </div>
        </dl>
      </section>

      {/* ── 价值 —— 说人话 ─────────────────────────── */}
      <section className="mt-14 space-y-6">
        <h2 className="font-mono text-sm font-medium text-muted-foreground">
          为什么不是又一个题库
        </h2>

        <ul className="divide-y divide-border border-y border-border">
          {VALUES.map((v, i) => (
            <li
              key={v.tag}
              className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 py-5 sm:grid-cols-[5rem_1fr]"
            >
              <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-0.5">
                <span className="font-mono text-xs text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs uppercase tracking-wide text-primary">
                  {v.tag}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">{v.hook}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── 两个方向,具体内容 ──────────────────────── */}
      {cats.length > 0 && (
        <section className="mt-14 space-y-6">
          <h2 className="font-mono text-sm font-medium text-muted-foreground">
            两个方向,各练各的
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cats.map((c) => (
              <a
                key={c.slug}
                href={`#/${c.slug}`}
                className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/60 hover:bg-accent/40"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">{c.name}</h3>
                  <span className="font-mono text-sm text-primary">
                    {c.count}
                    <span className="ml-1 text-xs text-muted-foreground">题</span>
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.modules?.length ?? 0} 个模块
                  </span>
                  <span className="ml-auto text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    进入 →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="mt-16 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>纯前端,开源。数据只存你的浏览器。</p>
        <a
          href="https://github.com/starlibaixing-coder/resume-assistant"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <span className="text-border">↗</span>
          github.com/starlibaixing-coder/resume-assistant
        </a>
      </footer>
    </div>
  );
}
