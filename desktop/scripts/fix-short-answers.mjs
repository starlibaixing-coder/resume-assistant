/*
 * fix-short-answers.mjs
 *
 * 修复 fe 题库中答案过短的题：从 fe.md 重新提取完整答案段，更新 YAML。
 * 根因：convert-fe.mjs 的 extractFeSection 把 **1. 结构** 这类子标题当边界截断了。
 *
 * Usage: node fix-short-answers.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const FE_MD = join(REPO_ROOT, 'docs', 'fe.md');
const FE_DIR = join(REPO_ROOT, 'banks', 'fe');
const MIN_CHARS = 50;

// 从 fe.md 提取指定题号的完整内容块
function extractQuestionBlock(text, globalNum) {
  const lines = text.split('\n');
  // 找 ### N. 标题
  const titleRe = new RegExp(`^###\\s+${globalNum}\\.\\s+`);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (titleRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  // 块到下一个 ### 或文件尾
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s+\d+\./.test(lines[i])) {
      end = i;
      break;
    }
  }
  // 也要在 --- 处截断
  for (let i = start + 1; i < end; i++) {
    if (/^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

// 提取标签段：从 **label** 到下一个 **xxx**（但 xxx 必须是已知段标签，不是子标题）
// 已知段标签：💡 📖 🔧 🔍 📚
function extractFeSectionFixed(block, labelPrefix) {
  // 📖 段吃到下一个带 emoji 的段标签(🔧🔍📚💡)或 --- 或块尾
  // 不在 **子标题** 处截断（子标题无 emoji）
  const re = new RegExp(`\\*\\*${labelPrefix}[^*]*\\*\\*\\s*\\n([\\s\\S]+?)(?=\\n\\*\\*(?:💡|📖|🔧|🔍|📚)[^*]*\\*\\*|\\n---|$)`);
  const m = block.match(re);
  if (!m) return null;

  let content = m[1];

  return content.trim();
}

// 把文本块转成 bullet 数组
function toBullets(text) {
  if (!text) return [];
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  // 过滤分隔线
  const content = lines.filter((l) => !/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l.trim()));
  // 有 bullet 的提取
  const bullets = content.filter((l) => /^[-*]\s+/.test(l.trim()));
  if (bullets.length) {
    return bullets.map((l) => l.trim().replace(/^[-*]\s+/, ''));
  }
  // 无 bullet，把带 ** 加粗子标题的行也作为独立条目
  return content.filter((l) => l.trim());
}

function main() {
  const feText = readFileSync(FE_MD, 'utf-8');

  // 收集所有 fe YAML 文件中答案过短的题
  const yamlFiles = readdirSync(FE_DIR).filter((f) => f.endsWith('.yaml') && /^\d{2}-/.test(f));
  let fixedCount = 0;
  const stillShort = [];

  for (const yf of yamlFiles) {
    const yamlPath = join(FE_DIR, yf);
    const modData = yamlLoad(readFileSync(yamlPath, 'utf-8'));
    if (!modData || !modData.questions) continue;

    let modified = false;
    for (const q of modData.questions) {
      const answerLen = (q.answer || []).join('').length;
      if (answerLen >= MIN_CHARS) continue;

      // q.id 形如 "04.36"，全局题号是 36
      const globalNum = parseInt(q.id.split('.')[1], 10);
      const block = extractQuestionBlock(feText, globalNum);
      if (!block) {
        stillShort.push(`${yf} Q${q.id}: fe.md 找不到题号 ${globalNum}`);
        continue;
      }

      const detail = extractFeSectionFixed(block, '📖');
      const example = extractFeSectionFixed(block, '🔧');

      const answerParts = [];
      if (detail) answerParts.push(...toBullets(detail));
      if (example) {
        answerParts.push('**示例:**');
        answerParts.push(...toBullets(example));
      }

      if (answerParts.join('').length >= MIN_CHARS) {
        q.answer = answerParts;
        modified = true;
        fixedCount++;
        console.log(`  ✓ ${yf} Q${q.id}: ${answerLen} -> ${answerParts.join('').length} 字`);
      } else {
        stillShort.push(`${yf} Q${q.id}: 重新提取后仍 ${answerParts.join('').length} 字`);
      }
    }

    if (modified) {
      writeFileSync(yamlPath, yamlDump(modData, { lineWidth: -1, quotingType: '"' }), 'utf-8');
    }
  }

  console.log(`\n修复 ${fixedCount} 题`);
  if (stillShort.length) {
    console.log('\n仍过短:');
    stillShort.forEach((s) => console.log(`  ! ${s}`));
  }
}

main();
