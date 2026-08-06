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
  const moduleCount = cats.reduce((sum, c) => sum + (c.modules?.length ?? 0), 0) || 34;

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

        {/* 规模统计 -- 紧凑内联,一眼看到量级 */}
        <p className="font-mono text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{total}</span> 题
          <span className="mx-2 text-border">·</span>
          <span className="text-foreground font-semibold">{cats.length || 2}</span> 方向
          <span className="mx-2 text-border">·</span>
          <span className="text-foreground font-semibold">{moduleCount}</span> 模块
        </p>

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
