import { useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useQuestions } from '@/lib/questions';
import { MY_CATEGORY_SLUG, getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrowsePage } from '@/pages/browse';
import { DraftsBoard } from '@/pages/drafts';

// 题库空间(v10 交互重做):分类切换 + 浏览/审核 两模式合一,**单一上下文页头**
// (此前外层「题库」+ 内层各模式自己的页头纵向堆叠)。浏览/审核都是
// 「选行 → 详情就地操作」的双栏工作台。?category= 深链定分类;?tab=review 进审核。
// 旧路由 /drafts、/:category、/:category/browse 均重定向到本页对应参数。

export function LibraryPage() {
  const { data } = useQuestions();
  const [params, setParams] = useSearchParams();
  // 待审计数跟随 mylib 变化,页头描述即时更新
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
  const categoryName = categories.find((c) => c.slug === category)?.name ?? '';

  return (
    <div className="space-y-5">
      <PageHeader
        title={tab === 'review' ? '审核' : '题库'}
        description={
          tab === 'review'
            ? pendingCount > 0
              ? `${pendingCount} 题待审核;选中题先想后看答案,通过才进学习队列。`
              : 'AI 生成的题先进这里,逐题把关。'
            : '选中行在右侧看题面与答案,编辑、删除就地完成;学习、评分去「练习」空间。'
        }
        actions={
          <Button size="sm" variant="secondary" asChild>
            <Link to="/add">
              <Plus className="size-3.5" aria-hidden />
              添加题目
            </Link>
          </Button>
        }
      />

      {/* 分类切换 + 模式 tab:一行两控,状态都进 URL */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
              <SelectTrigger aria-label="分类" className="h-8 w-44 text-xs">
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
        {tab === 'review' && categoryName && (
          <span className="text-xs text-muted-foreground">当前分类:{categoryName}(审核覆盖全部批次)</span>
        )}
      </div>

      <Tabs value={tab}>
        <TabsContent value="browse" className="mt-0">
          <BrowsePage category={category} />
        </TabsContent>
        <TabsContent value="review" className="mt-0">
          <DraftsBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
