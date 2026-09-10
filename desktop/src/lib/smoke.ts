// 真机冒烟(SMOKE=1):走真 SQLite(smoke.db,后端已注册同套迁移),五步自检,
// 每步经 smoke_report 打到 stdout,smoke_finish 以退出码收尾(scripts/smoke.py 汇总)。

import { invoke } from '@tauri-apps/api/core';

import { countStatus } from './bank';
import { newCard, rate } from './scheduler';
import {
  _resetStorageForTest,
  approvePending,
  deleteMyQuestion,
  ensureSchema,
  getCard,
  getMyQuestions,
  initStorage,
  recordRating,
  saveMyQuestion,
} from './storage';
import { buildQueue } from './session';
import type { Question } from './types';

async function report(step: string, pass: boolean, detail: string): Promise<void> {
  await invoke('smoke_report', { step, pass, detail });
}

function fakeQuestion(id: string, status: 'approved' | 'pending' = 'approved'): Question {
  const now = Date.now();
  return {
    id,
    origin: 'my',
    category: 'my',
    module: 1,
    moduleName: '冒烟模块',
    index: 1,
    difficulty: '中',
    title: `冒烟测试题 ${id}`,
    focus: '存储链路是否完好',
    answer: ['这是一条不少于五十字的冒烟测试答案要点,用于验证 SQLite 读写与缓存链路都正常工作,包含足够的字符数。'],
    followups: [],
    tags: ['smoke'],
    status,
    source: 'manual',
    sourceId: null,
    sourceRef: '',
    jdId: null,
    isCode: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function runSmoke(): Promise<void> {
  let pass = true;
  const fail = (detail: string) => {
    pass = false;
    return detail;
  };

  try {
    _resetStorageForTest();
    await initStorage({ file: 'sqlite:smoke.db', loadBundledBank: false });
    const db = await (async () => {
      const { openDb } = await import('./db');
      return openDb('sqlite:smoke.db');
    })();
    if (db) await ensureSchema(db);
    await report('init-storage', true, `缓存预热完成`);
  } catch (e) {
    await report('init-storage', false, fail(e instanceof Error ? e.message : String(e)));
    await invoke('smoke_finish', { passed: false });
    return;
  }

  try {
    // 1. 题目写入往返
    const q = fakeQuestion('my.smoke.1');
    saveMyQuestion(q);
    const found = getMyQuestions().find((x) => x.id === q.id);
    await report('question-roundtrip', !!found, found ? '我的题写入缓存成功' : fail('写入后读不到'));

    // 2. 评分 → review_state
    const card = rate(null, 'ok', Date.now());
    const { saveCard } = await import('./storage');
    saveCard(q.id, card, 'my');
    const back = getCard(q.id);
    const dueOk = back ? new Date(back.dueAt).getHours() === 0 && new Date(back.dueAt).getMinutes() === 0 : false;
    await report('rating-due', !!back && dueOk, back ? `due=${new Date(back.dueAt).toISOString()} interval=${back.intervalDays}` : fail('评分后无卡片'));

    // 3. rating_log → activity
    recordRating(q.id, 'ok', Date.now());
    const { activityDays } = await import('./storage');
    const days = activityDays();
    await report('activity-log', days.length > 0 && days[0].rated >= 1, `activity ${days[0]?.day ?? '-'} rated=${days[0]?.rated ?? 0}`);

    // 4. pending 通过 → 正式 id
    const p = fakeQuestion('gen.smoke.1', 'pending');
    saveMyQuestion(p);
    const newId = approvePending('gen.smoke.1');
    await report('approve-pending', !!newId && newId!.startsWith('my.'), `新 id=${newId ?? '-'}`);

    // 5. 级联删除
    deleteMyQuestion(newId!);
    deleteMyQuestion('my.smoke.1');
    await report('cascade-delete', getMyQuestions().length === 0, `剩余我的题 ${getMyQuestions().length}`);

    // 6. 队列构造(review 只含到期)
    const now = Date.now();
    const dueCard = rate(null, 'ok', now - 3 * 24 * 60 * 60 * 1000);
    saveMyQuestion(fakeQuestion('my.smoke.9'));
    saveCard('my.smoke.9', dueCard, 'my');
    saveMyQuestion(fakeQuestion('my.smoke.10'));
    const queue = buildQueue({
      type: 'review',
      questions: [{ id: 'my.smoke.9' }, { id: 'my.smoke.10' }],
      cards: new Map([['my.smoke.9', dueCard]]),
      batchSize: 'all',
    });
    const counts = countStatus(getMyQuestions(), new Map([['my.smoke.9', dueCard]]), now);
    await report(
      'queue-review',
      queue.length === 1 && queue[0].qid === 'my.smoke.9' && counts.due === 1 && counts.new === 1,
      `复习队列 ${queue.length} 项,五档计数 待复习=${counts.due} 待学习=${counts.new}`,
    );

    // 新卡数值锚点:首评 ok → 3 天
    const c2 = rate(null, 'ok', now);
    await report('sm2-anchor', c2.intervalDays === 3 && newCard(now).ef === 2.5, `首评 ok 间隔 ${c2.intervalDays} 天`);
  } catch (e) {
    await report('smoke-steps', false, fail(e instanceof Error ? e.message : String(e)));
  }

  await invoke('smoke_finish', { passed: pass });
}
