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

        // --- 题目设计质量检查（启发式，见 QUALITY.md）---

        // 检查 1：多问一题（题干含 ≥3 个问号，2个问号递进太常见不报）
        const qMarkCount = (q.title.match(/？/g) || []).length;
        if (qMarkCount >= 3) {
          issues.push({
            type: 'design', severity: '中', id: fullId, loc,
            msg: `疑似多问一题(${qMarkCount}个问号)，需确认子问题是否有递进关系`,
            title: q.title,
          });
        }

        // 检查 2：追问括号含答案提示
        // 排除交叉引用(见 Q/详见模块)，只报括号内容 >10 字的
        if (Array.isArray(q.followups)) {
          for (const fu of q.followups) {
            const parenMatch = fu.match(/[（(]([^)）]{11,})[)）]/);
            if (parenMatch && !/见\s*Q|详见|参考\s/.test(parenMatch[1])) {
              issues.push({
                type: 'design', severity: '中', id: fullId, loc,
                msg: `追问疑似含答案提示: 括号内"${parenMatch[1].slice(0, 20)}"`,
                title: q.title,
              });
            }
          }
        }

        // 检查 3：题干自我回答（后半句关键词在答案中出现）
        // 仅在 ≥3 问号时触发，降低误报
        if (qMarkCount >= 3 && Array.isArray(q.answer)) {
          const titleParts = q.title.split('？').filter((s) => s.trim());
          if (titleParts.length >= 2) {
            const latter = titleParts[titleParts.length - 1];
            // 提取后半句的实词（≥2字的中文/英文词）
            const keywords = latter.match(/[\u4e00-\u9fa5]{2,}|[A-Za-z]{3,}/g) || [];
            const answerText = q.answer.join('');
            const leaked = keywords.filter((k) => answerText.includes(k));
            if (leaked.length >= 2) {
              issues.push({
                type: 'design', severity: '中', id: fullId, loc,
                msg: `疑似答案泄漏进题干: 后半句关键词(${leaked.slice(0, 3).join('/')})在答案中出现`,
                title: q.title,
              });
            }
          }
        }

        // AI 审查 prompt（除非 --format-only）
        if (!formatOnly) {
          aiPrompts.push({
            id: fullId,
            loc,
            title: q.title,
            difficulty: q.difficulty,
            focus: q.focus,
            answer: q.answer,
            prompt: `审查以下面试题，检查两方面：\n1. 答案有无硬错误（事实性/技术性）\n2. 题目设计是否有缺陷：答案泄漏进题干/追问隐含答案/一题塞多个无递进独立问题/概念层次混乱\n有问题指出并给修正建议，标注置信度（高/中/低）。无问题回复"无问题"。\n\n题目: ${q.title}\n考察点: ${q.focus}\n答案:\n${q.answer.map((a) => `- ${a}`).join('\n')}${q.followups && q.followups.length ? '\n追问:\n' + q.followups.map((f) => `- ${f}`).join('\n') : ''}`,
          });
        }
      }
    }
  }

  // 生成报告
  const date = new Date().toISOString().slice(0, 10);
  const formatIssues = issues.filter((i) => i.type === 'format');
  const designIssues = issues.filter((i) => i.type === 'design');
  const reportLines = [
    `# 题库质量审查报告 ${date}`,
    '',
    `- 总题数: ${totalQuestions}`,
    `- 格式问题: ${formatIssues.length}`,
    `- 题目设计疑似问题: ${designIssues.length}（启发式，需人工确认）`,
    `- AI 审查批次: ${aiPrompts.length} 题`,
    '',
  ];

  if (formatIssues.length) {
    reportLines.push('## 格式问题');
    for (const i of formatIssues) {
      reportLines.push(`- **${i.id}** (${i.loc}): ${i.msg}`);
    }
    reportLines.push('');
  } else {
    reportLines.push('## 格式问题', '无', '');
  }

  if (designIssues.length) {
    reportLines.push('## 题目设计疑似问题（启发式，需人工确认）');
    reportLines.push('依据 QUALITY.md 四条原则。以下为自动扫描结果，可能误报。');
    reportLines.push('');
    // 按问题类型分组
    const multiQ = designIssues.filter((i) => i.msg.includes('多问一题'));
    const parenHint = designIssues.filter((i) => i.msg.includes('答案提示'));
    const leak = designIssues.filter((i) => i.msg.includes('答案泄漏'));
    if (multiQ.length) {
      reportLines.push(`### 疑似多问一题（${multiQ.length}）`);
      for (const i of multiQ) {
        reportLines.push(`- **${i.id}** (${i.loc}): ${i.msg}`);
        reportLines.push(`  - 题干: ${i.title}`);
      }
      reportLines.push('');
    }
    if (parenHint.length) {
      reportLines.push(`### 追问疑似含答案提示（${parenHint.length}）`);
      for (const i of parenHint) {
        reportLines.push(`- **${i.id}** (${i.loc}): ${i.msg}`);
      }
      reportLines.push('');
    }
    if (leak.length) {
      reportLines.push(`### 疑似答案泄漏进题干（${leak.length}）`);
      for (const i of leak) {
        reportLines.push(`- **${i.id}** (${i.loc}): ${i.msg}`);
        reportLines.push(`  - 题干: ${i.title}`);
      }
      reportLines.push('');
    }
  } else {
    reportLines.push('## 题目设计疑似问题', '无', '');
  }

  if (aiPrompts.length) {
    reportLines.push('## AI 审查（待执行）');
    reportLines.push(`以下 ${aiPrompts.length} 题需 AI 审查内容正确性 + 题目设计。prompt 批次见同目录 .prompts.json。`);
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
  console.log(`  总题数 ${totalQuestions}, 格式问题 ${formatIssues.length}, 设计疑似 ${designIssues.length}`);
  console.log(`  报告: ${reportPath}`);
}

main();
