// 备份(§3.4):JSON 信封 v1(不含 secrets)+ YAML 题目导出(贡献回官方库用)。
// 下载通道:Blob + <a download>(浏览器/webview 通用降级);
// Tauri 原生「保存对话框 + fs 落盘」需后端补 dialog/fs 插件,见 docs/product/backend-todo.md。

import { buildEnvelope, type BackupEnvelope } from './storage';
import { isTauri } from './db';

export { buildEnvelope, type BackupEnvelope };

export function envelopeToJson(env: BackupEnvelope): string {
  return JSON.stringify(env, null, 2);
}

export function parseEnvelope(text: string): BackupEnvelope {
  const env = JSON.parse(text) as BackupEnvelope;
  if (env?.version !== 1 || !env.tables || typeof env.tables !== 'object') {
    throw new Error('不是有效的 CommitCareer 备份文件(version != 1)');
  }
  return env;
}

/** 下载文本文件;返回 false 表示当前环境不支持(真机需后端 dialog/fs 插件) */
export function downloadTextFile(filename: string, text: string, mime = 'application/json'): boolean {
  if (isTauri()) {
    // WKWebView 对 blob 下载支持不稳定,未验证前不在真机路径上提供
    return false;
  }
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** YAML 题目导出(仅我的 approved;字段与官方 banks YAML 对齐,G3) */
export function myQuestionsToYaml(questions: QuestionYamlSource[]): string {
  const lines: string[] = [];
  for (const q of questions) {
    lines.push('- id: ' + JSON.stringify(q.id));
    lines.push('  difficulty: ' + JSON.stringify(q.difficulty));
    lines.push('  tags:');
    for (const t of q.tags.length ? q.tags : ['']) lines.push('    - ' + JSON.stringify(t));
    lines.push('  title: ' + JSON.stringify(q.title));
    lines.push('  focus: ' + JSON.stringify(q.focus));
    lines.push('  answer:');
    for (const a of q.answer) lines.push('    - ' + JSON.stringify(a));
    lines.push('  followups:');
    for (const f of q.followups.length ? q.followups : ['']) lines.push('    - ' + JSON.stringify(f));
  }
  return `# CommitCareer 我的题库导出(贡献回官方题库请走 banks/clean 管线)\n` + lines.join('\n') + '\n';
}

export interface QuestionYamlSource {
  id: string;
  difficulty: string;
  tags: string[];
  title: string;
  focus: string;
  answer: string[];
  followups: string[];
}
