// 真机冒烟自检(SMOKE=1 / --smoke 启动时由 main.tsx 调起)。
// 走真 SQLite(smoke.db,迁移由 Rust 注册),不触碰用户数据(resume.db)。
// 五步:连接+迁移 → 写读删回环 → key 存取 → 档案存取 → 草稿→approve 链路。
// 每步结果经 invoke(smoke_report) 打到 stdout,结束由 main.tsx 调 smoke_finish 退出。

export async function runSmoke(): Promise<boolean> {
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  const { invoke } = await import('@tauri-apps/api/core');

  const report = async (step: string, pass: boolean, detail: string) => {
    console.log(`[smoke] ${pass ? 'PASS' : 'FAIL'}  ${step}  ${detail}`);
    try {
      await invoke('smoke_report', { step, pass, detail });
    } catch {
      // 日志通道尽力而为,不因它判失败
    }
  };
  const step = async (name: string, fn: () => Promise<string>): Promise<boolean> => {
    try {
      await report(name, true, await fn());
      return true;
    } catch (e) {
      await report(name, false, e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  let db: InstanceType<typeof Database> | null = null;
  const results: boolean[] = [];

  results.push(
    await step('storage.init', async () => {
      db = await Database.load('sqlite:smoke.db');
      return 'sqlite:smoke.db 连接 + 迁移 001-006';
    }),
  );
  if (!db) return false;

  const { initMyLibDb, loadMyQuestionsFromDb, addDrafts, approveQuestion, getMyQuestions } = await import('./mylib');
  const { initProfileDb, loadProfileFromDb, saveProfile, getProfile } = await import('./profile');
  const { initJdsDb, loadJdsFromDb, addJd, getJds } = await import('./jd');
  const { initSecretsDb, loadSecretsFromDb, setSecret, getSecret } = await import('./secrets');
  initMyLibDb(db);
  await loadMyQuestionsFromDb();
  initProfileDb(db);
  await loadProfileFromDb();
  initJdsDb(db);
  await loadJdsFromDb();
  initSecretsDb(db);
  await loadSecretsFromDb();

  results.push(
    await step('storage.roundtrip', async () => {
      await db!.execute(
        "INSERT INTO secrets(name, value) VALUES('_smoke', '1') ON CONFLICT(name) DO UPDATE SET value = '1'",
        [],
      );
      const rows = await db!.select<Array<{ value: string }>>("SELECT value FROM secrets WHERE name = '_smoke'");
      if (rows[0]?.value !== '1') throw new Error('写入后读回不一致');
      await db!.execute("DELETE FROM secrets WHERE name = '_smoke'", []);
      return '写读删回环(execute 权限 / 磁盘)';
    }),
  );

  results.push(
    await step('secrets.key', async () => {
      await setSecret('llm-api-key', 'sk-smoke');
      if ((await getSecret('llm-api-key')) !== 'sk-smoke') throw new Error('key 写读不一致');
      await setSecret('llm-api-key', '');
      if ((await getSecret('llm-api-key')) !== '') throw new Error('key 清除失败');
      return 'key 落库读回 + 清除';
    }),
  );

  results.push(
    await step('profile.save', async () => {
      await saveProfile({ company: 'smoke 公司', resume: '# smoke 简历' });
      const p = getProfile();
      if (p?.company !== 'smoke 公司' || !p.resume) throw new Error('档案写读不一致');
      // JD 走 jds 表(中枢一期):INSERT 自增 id 回填 + 列表读回
      const jd = await addJd({ title: '', company: 'smoke 公司', content: '负责 smoke 自检…' });
      if (!getJds().some((j) => j.id === jd.id && j.content.includes('smoke'))) throw new Error('JD 写读不一致');
      return '档案(公司+简历)+ JD(jds 表)存取';
    }),
  );

  results.push(
    await step('mylib.flow', async () => {
      const [q] = await addDrafts(
        [
          {
            difficulty: '中' as const,
            title: 'smoke 题干:冒烟链路验证?',
            focus: '冒烟自检',
            answer: [`${'冒'.repeat(30)}烟答案内容,凑足五十字以上的技术要点表述,确保通过共享校验。`],
            followups: [],
            tags: ['smoke'],
          },
        ],
        'smoke 批次',
      );
      await approveQuestion(q.id);
      const approved = getMyQuestions().find((x) => x.id === q.id);
      if (approved?.status !== 'approved') throw new Error('草稿 → approve 链路断裂');
      return `草稿 → approve → 聚合(${q.id})`;
    }),
  );

  results.push(
    await step('official.seed', async () => {
      const ob = await import('./officialbank');
      ob.initOfficialDb(db!);
      await ob.ensureOfficial();
      const total = ob.getOfficial()?.total ?? 0;
      if (!total) throw new Error('官方题播种后为空');
      return `官方题入库 ${total} 题(包内快照播种,读路径=DB 物化)`;
    }),
  );

  return results.every(Boolean);
}
