/*
 * audit.mjs
 *
 * 质量检测 Step 1：扫描所有 YAML 题库，检查格式 + AI 审查内容正确性，生成报告。
 *
 * 格式检查：answer 总字数 < 50、字段缺失、difficulty 非法等（build.mjs 已覆盖，这里复检）。
 * AI 审查：把每题答案喂 LLM，判硬错误 + 给修正建议 + 置信度。
 *
 * 当前版本：格式检查全自动化；AI 审查生成待发送 prompt 批次，供外部 LLM 调用。
 *
 * Usage: node audit.mjs [--format-only]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const BANKS_DIR = join(REPO_ROOT, 'banks');
const REPORTS_DIR = join(__dirname, 'reports');
const MIN_ANSWER_CHARS = 50;
const VALID_DIFFICULTIES = ['初', '中', '高'];

import { createRequire } from 'node:module';
const require = createRequire(join(REPO_ROOT, 'quiz-app', 'package.json'));
const { load: yamlLoad } = require('js-yaml');

function main() {
  const formatOnly = process.argv.includes('--format-only');
  mkdirSync(REPORTS_DIR, { recursive: true });

  const catDirs = readdirSync(BANKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'clean' && d.name !== 'audit')
    .map((d) => d.name)
    .sort();

  const issues = [];
  const aiPrompts = [];
  let totalQuestions = 0;

  for (const catDir of catDirs) {
    const catPath = join(BANKS_DIR, catDir);
    const metaPath = join(catPath, 'meta.yaml');
    if (!existsSync(metaPath)) continue;

    const metaText = readFileSync(metaPath, 'utf-8');
    const slugMatch = metaText.match(/^slug:\s*(.+)$/m);
    const slug = slugMatch ? slugMatch[1].trim() : catDir;

    const yamlFiles = readdirSync(catPath).filter((f) => f.endsWith('.yaml') && /^\d{2}-/.test(f));

    for (const yf of yamlFiles) {
      let modData;
      try {
        modData = yamlLoad(readFileSync(join(catPath, yf), 'utf-8'));
      } catch (e) {
        issues.push({ type: 'format', severity: '高', id: `${slug}/${yf}`, msg: `YAML 解析失败: ${e.message}` });
        continue;
      }
      if (!modData || !modData.questions) continue;

      for (const q of modData.questions) {
        totalQuestions++;
        const fullId = `${slug}.${q.id}`;
        const loc = `${yf} Q${q.id}`;

        // 格式检查
        if (!q.difficulty || !VALID_DIFFICULTIES.includes(q.difficulty)) {
          issues.push({ type: 'format', severity: '高', id: fullId, loc, msg: `difficulty 非法: "${q.difficulty}"` });
        }
        if (!Array.isArray(q.answer)) {
          issues.push({ type: 'format', severity: '高', id: fullId, loc, msg: 'answer 非数组' });
        } else {
          const len = q.answer.join('').length;
          if (len < MIN_ANSWER_CHARS) {
            issues.push({ type: 'format', severity: '高', id: fullId, loc, msg: `答案过短(${len}字 < ${MIN_ANSWER_CHARS})` });
          }
        }
        if (!q.title) issues.push({ type: 'format', severity: '高', id: fullId, loc, msg: '缺 title' });
        if (q.focus == null) issues.push({ type: 'format', severity: '高', id: fullId, loc, msg: '缺 focus' });

        // AI 审查 prompt（除非 --format-only）
        if (!formatOnly) {
          aiPrompts.push({
            id: fullId,
            loc,
            title: q.title,
            difficulty: q.difficulty,
            focus: q.focus,
            answer: q.answer,
            prompt: `审查以下面试题答案是否有硬错误（事实性/技术性错误）。如果有，指出错误并给出修正建议，标注置信度（高/中/低）。如果无错误，回复"无问题"。\n\n题目: ${q.title}\n考察点: ${q.focus}\n答案:\n${q.answer.map((a) => `- ${a}`).join('\n')}`,
          });
        }
      }
    }
  }

  // 生成报告
  const date = new Date().toISOString().slice(0, 10);
  const reportLines = [
    `# 题库质量审查报告 ${date}`,
    '',
    `- 总题数: ${totalQuestions}`,
    `- 格式问题: ${issues.filter((i) => i.type === 'format').length}`,
    `- AI 审查批次: ${aiPrompts.length} 题`,
    '',
  ];

  const formatIssues = issues.filter((i) => i.type === 'format');
  if (formatIssues.length) {
    reportLines.push('## 格式问题');
    for (const i of formatIssues) {
      reportLines.push(`- **${i.id}** (${i.loc}): ${i.msg}`);
    }
    reportLines.push('');
  } else {
    reportLines.push('## 格式问题', '无', '');
  }

  if (aiPrompts.length) {
    reportLines.push('## AI 审查（待执行）');
    reportLines.push(`以下 ${aiPrompts.length} 题需 AI 审查内容正确性。prompt 批次见同目录 .prompts.json。`);
    reportLines.push('');
    reportLines.push('审查完成后，将结果追加到本报告"AI 审查结果"章节，再跑 fix.mjs 自动修正高置信度项。');
  }

  const reportPath = join(REPORTS_DIR, `${date}.md`);
  writeFileSync(reportPath, reportLines.join('\n') + '\n', 'utf-8');

  // 输出 AI 审查 prompt 批次
  if (aiPrompts.length) {
    const promptsPath = join(REPORTS_DIR, `${date}.prompts.json`);
    writeFileSync(promptsPath, JSON.stringify(aiPrompts, null, 2), 'utf-8');
    console.log(`AI 审查 prompt 批次: ${promptsPath} (${aiPrompts.length} 题)`);
  }

  console.log(`✓ 审查完成`);
  console.log(`  总题数 ${totalQuestions}, 格式问题 ${formatIssues.length}`);
  console.log(`  报告: ${reportPath}`);
}

main();
