/*
 * fix.mjs
 *
 * 质量检测 Step 2：读审查报告中的高置信度问题，调用 LLM 修正答案，写回 YAML。
 *
 * 输入：audit/reports/YYYY-MM-DD.json（审查结果，含 id/problem/suggestion/confidence）
 * 流程：对 confidence=高 的项 -> 调 LLM 修正 -> build.mjs 校验 -> 写回 YAML
 *
 * 当前版本：读审查结果、筛高置信度、生成修正 prompt 批次。
 * 实际 LLM 调用需外部完成，修正后的 YAML 跑 build.mjs 校验。
 *
 * Usage: node fix.mjs <报告日期>   例: node fix.mjs 2026-07-30
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const REPORTS_DIR = join(__dirname, 'reports');

import { createRequire } from 'node:module';
const require = createRequire(join(REPO_ROOT, 'quiz-app', 'package.json'));
const { load: yamlLoad, dump: yamlDump } = require('js-yaml');

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function main() {
  const [date] = process.argv.slice(2);
  if (!date) die('Usage: node fix.mjs <报告日期>\n  例: node fix.mjs 2026-07-30');

  const resultPath = join(REPORTS_DIR, `${date}.json`);
  if (!existsSync(resultPath)) die(`审查结果文件不存在: ${resultPath}\n请先跑 audit.mjs 并填入 AI 审查结果。`);

  const results = JSON.parse(readFileSync(resultPath, 'utf-8'));
  const highConfidence = results.filter((r) => r.confidence === '高' && r.suggestion);

  if (!highConfidence.length) {
    console.log('没有高置信度问题需要自动修正。');
    console.log('低/中置信度项请人工查看报告。');
    return;
  }

  // 生成修正 prompt 批次
  const fixPrompts = highConfidence.map((r) => ({
    id: r.id,
    problem: r.problem,
    suggestion: r.suggestion,
    prompt: `修正以下面试题答案。问题: ${r.problem}\n建议: ${r.suggestion}\n\n请根据建议修正答案，只改有问题的地方，输出完整的 questions 数组中这一题的 YAML（含 id/difficulty/tags/title/focus/answer/followups 全部字段）。`,
  }));

  const outPath = join(REPORTS_DIR, `${date}-fix-prompts.json`);
  writeFileSync(outPath, JSON.stringify(fixPrompts, null, 2), 'utf-8');

  console.log(`✓ 生成修正 prompt: ${outPath}`);
  console.log(`  高置信度问题: ${highConfidence.length} 题`);
  console.log('');
  console.log('下一步:');
  console.log('  1. 把 fix-prompts 发给 LLM 获取修正后的 YAML');
  console.log('  2. 用修正结果替换 banks/<slug>/<file>.yaml 中对应题目');
  console.log('  3. 跑 node quiz-app/scripts/build.mjs 校验');
  console.log('  4. 低/中置信度项人工复核');
}

main();
