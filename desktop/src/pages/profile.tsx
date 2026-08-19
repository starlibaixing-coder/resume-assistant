import { useState } from 'react';
import { toast } from 'sonner';
import { getProfile, saveProfile, type JobProfile } from '@/lib/profile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/page-header';

// 求职目标档案(ADR-4 中枢):公司/JD/简历,被「JD 定向生题」(本阶段)与
// 简历生成/模拟面试(阶段 3/5)共享。录入 = 纯粘贴,校验放消费侧(JD 定向要求 JD 非空)。

const charCount = (s: string) => (s ? `${s.length} 字` : '未填');

export function ProfilePage() {
  const saved = getProfile();
  const [company, setCompany] = useState(saved?.company ?? '');
  const [jd, setJd] = useState(saved?.jd ?? '');
  const [resume, setResume] = useState(saved?.resume ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = !!saved
    ? saved.company !== company || saved.jd !== jd || saved.resume !== resume
    : !!(company || jd || resume);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ company: company.trim(), jd: jd.trim(), resume: resume.trim() });
      toast.success('档案已保存');
    } catch (e) {
      toast.error('保存失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="求职目标"
        subtitle="JD 定向生题读这份档案;后续简历生成、模拟面试(阶段 3/5)也围绕它。JD 必填才能定向生题,简历建议贴 markdown 全文。"
      />

      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">公司 / 岗位</label>
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="如:示例公司 · AI 应用工程师"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-mono">职位描述(JD)</label>
              <span className="font-mono text-[10px] text-muted-foreground">{charCount(jd)}</span>
            </div>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="粘贴目标岗位的 JD 全文。定向生题按 JD 的技术要求出题,核心必备项优先。"
              rows={10}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-mono">我的简历</label>
              <span className="font-mono text-[10px] text-muted-foreground">{charCount(resume)}</span>
            </div>
            <Textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder="粘贴简历全文(markdown)。定向生题可选「结合简历深挖」;留空则只按 JD 出题。"
              rows={14}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {dirty ? '有未保存的修改' : '已与档案同步'}
            </span>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? '保存中…' : '保存档案'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type { JobProfile };
