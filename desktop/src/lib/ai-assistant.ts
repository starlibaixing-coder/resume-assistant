import { isTauri } from './secrets';
import { logger } from './logger';
import { toast } from 'sonner';

// 问 AI 子窗口:应用内嵌 chat.qwen.ai 的独立 webview 窗口。
// 不用 iframe:该类 AI 站点带 X-Frame-Options/CSP frame-ancestors 拦截,且第三方
// iframe 里登录态不可用;独立 webview 是真浏览器上下文,登录态存在应用数据目录,
// 首次登录后续免登。ai-chat 窗口不在 capabilities 的 windows 列表里——远端页面
// 拿不到任何 IPC(不配 dangerousRemoteDomainIpcAccess),默认安全。
// 浏览器/web 层降级为新标签页打开。

export const AI_CHAT_URL = 'https://chat.qwen.ai/';
const AI_WINDOW_LABEL = 'ai-chat';

export async function openAiAssistant(): Promise<void> {
  if (!isTauri()) {
    window.open(AI_CHAT_URL, '_blank', 'noopener');
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(AI_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }
  const win = new WebviewWindow(AI_WINDOW_LABEL, {
    url: AI_CHAT_URL,
    title: '问 AI',
    width: 460,
    height: 680,
  });
  win.once('tauri://error', (e) => {
    logger.error(`[ai-assistant] 子窗口创建失败: ${String((e as { payload?: unknown }).payload ?? e)}`);
    toast.error('问 AI 窗口打开失败');
  });
}
