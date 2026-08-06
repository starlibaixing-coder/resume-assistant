import { useQuestions } from '@/lib/questions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
        <div className="flex flex-wrap gap-3 justify-center pt-2">
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
        <p>题库以 YAML 为源,社区共建。github.com/starlibaixing-coder/resume-assistant</p>
      </div>
    </div>
  );
}
