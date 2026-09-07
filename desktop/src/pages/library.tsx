import { useSearchParams } from 'react-router';
import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { useQuestions } from '@/lib/questions';
import { MY_CATEGORY_SLUG, getMyCategory } from '@/lib/mylib';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BrowsePage } from '@/pages/browse';
import { DraftsBoard } from '@/pages/drafts';

// 题库空间(v4「今日驱动」IA):分类切换 + 浏览/审核 两个模式合一。
// 浏览 = 主从分栏题目列表;审核 = AI 产物把关(原独立待审核页收编于此)。
// ?category= 深链定分类;?tab=review 进审核模式。旧路由 /drafts、/:category、
// /:category/browse 均重定向到本页对应参数。「添加题目」是独立页 /add(从这进)。

export function LibraryPage() {
  const { data } = useQuestions();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'review' ? 'review' : 'browse';
  const myCategory = getMyCategory();

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
    <div className="space-y-5">
      <PageHeader
        title="题库"
        description="浏览、管理与审核;练习去「练习」空间。"
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
        <Tabs value={tab} onValueChange={(v) => setParams(v === 'review' ? { category, tab: 'review' } : { category }, { replace: true })}>
          <TabsList>
            <TabsTrigger value="browse">浏览</TabsTrigger>
            <TabsTrigger value="review">审核</TabsTrigger>
          </TabsList>
        </Tabs>
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
