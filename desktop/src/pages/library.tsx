import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useQuestions } from '@/lib/questions';
import { MY_CATEGORY_SLUG, getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrowsePage } from '@/pages/browse';
import { DraftsBoard } from '@/pages/drafts';

// 题库空间(v11 全窗工作台):标题进工具条(不再有大页头),下方工具行 + 双栏吃满全窗。
// 分类切换 + 浏览/审核 两模式;?category= 深链定分类;?tab=review 进审核。
// 旧路由 /drafts、/:category、/:category/browse 均重定向到本页对应参数。

export function LibraryPage() {
  const { data } = useQuestions();
  const [params, setParams] = useSearchParams();
  // 待审计数跟随 mylib 变化,工具条描述即时更新
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const tab = params.get('tab') === 'review' ? 'review' : 'browse';
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  const categories = [
    ...(data?.categories ?? [])
      .filter((c) => c.slug !== 'my')
      .map((c) => ({ slug: c.slug, name: c.name })),
    { slug: MY_CATEGORY_SLUG, name: myCategory.name },
  ];
  const requested = params.get('category');
  const category = categories.some((c) => c.slug === requested)
    ? requested!
    : categories[0]?.slug ?? MY_CATEGORY_SLUG;

  return (
    <div className="flex h-full flex-col">
      {/* 标题工具条 */}
      <div className="flex h-12 shrink-0 items-center gap-3 px-5">
        <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
          {tab === 'review' ? '审核' : '题库'}
        </h1>
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {tab === 'review'
            ? pendingCount > 0
              ? `${pendingCount} 题待审核;选中题先想后看答案,通过才进学习队列。`
              : 'AI 生成的题先进这里,逐题把关。'
            : '选中行在右侧看题面与答案,编辑、删除就地完成。'}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {tab === 'browse' && (
            <label className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">分类</span>
              <Select
                value={category}
                onValueChange={(v) =>
                  setParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('category', v);
                      return next;
                    },
                    { replace: true },
                  )
                }
              >
                <SelectTrigger aria-label="分类" className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          <Tabs value={tab} onValueChange={(v) => setParams(v === 'review' ? { category, tab: 'review' } : { category }, { replace: true })}>
            <TabsList>
              <TabsTrigger value="browse">浏览</TabsTrigger>
              <TabsTrigger value="review">审核</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="secondary" asChild>
            <Link to="/add">
              <Plus className="size-3.5" aria-hidden />
              添加题目
            </Link>
          </Button>
        </div>
      </div>

      {/* 模式内容:吃满剩余高度 */}
      <Tabs value={tab} className="flex min-h-0 flex-1 flex-col">
        <TabsContent value="browse" className="mt-0 flex min-h-0 flex-1 flex-col">
          <BrowsePage category={category} />
        </TabsContent>
        <TabsContent value="review" className="mt-0 flex min-h-0 flex-1 flex-col">
          <DraftsBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
