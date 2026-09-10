// 问 AI:chat.qwen.ai 开独立子 webview 窗口(已开则 setFocus);
// ai-chat 不进 capabilities windows 列表 —— 远端页面零 IPC,默认安全;
// 浏览器降级新标签页;不用 iframe(X-Frame-Options 拦截 + 登录态不可用)。
// 题目文本写剪贴板,打开后直接粘贴即可。

import { isTauri } from './db';
import { logger } from './logger';
import type { Question } from './types';

const ASK_AI_URL = 'https://chat.qwen.ai/';

export async function openAskAi(q: Pick<Question, 'title' | 'focus'>): Promise<'window' | 'tab'> {
  const promptText = `我在准备面试,请讲解这道题并给出答题思路:\n\n题目:${q.title}\n考察方向:${q.focus}`;
  try {
    await navigator.clipboard.writeText(promptText);
  } catch {
    /* 剪贴板失败不阻塞开窗 */
  }
  if (isTauri()) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const existing = await WebviewWindow.getByLabel('ai-chat');
      if (existing) {
        await existing.setFocus();
        return 'window';
      }
      const win = new WebviewWindow('ai-chat', {
        url: ASK_AI_URL,
        title: '问 AI',
        width: 460,
        height: 680,
        focus: true,
      });
      win.once('tauri://error', (e) => logger.error(`[ai] 子窗口创建失败: ${e.payload}`));
      return 'window';
    } catch (e) {
      logger.warn(`[ai] 子窗口异常,降级浏览器: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  window.open(ASK_AI_URL, '_blank', 'noopener');
  return 'tab';
}
