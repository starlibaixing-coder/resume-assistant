/*
 * convert-fe.mjs
 *
 * 把 docs/fe.md 转换成 agent 题库同格式，拆到 banks/fe/ 下。
 *
 * 映射:
 *   ## <板块slug>            -> 独立文件 NN-<slug>.md（按出现顺序编号 01-19）
 *   ### N. <标题>            -> ### Q<模块号>.<序号>【<难度>】<标题>
 *   > ⭐⭐⭐ · 💡 ... · 🔥高频  -> 难度(⭐≤2 初 / ⭐3 中 / ⭐≥4 高)，高频等修饰存 tags
 *   **💡 一句话速记** 段      -> **考察点:**
 *   **📖 通俗详解** + **🔧 示例 / 代码** 段 -> **参考答案要点:**
 *   **🔍 常见追问** 段        -> **追问方向:**
 *   **📚 出处** 段           -> 丢弃
 *
 * Usage: node convert-fe.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC = join(REPO_ROOT, 'docs', 'fe.md');
const OUT_DIR = join(REPO_ROOT, 'banks', 'fe');

// 板块 slug -> 中文显示名（用于文件名可读性 + meta.yaml）
const SECTION_NAMES = {
  ai: 'AI',
  algorithm: '算法',
  browser: '浏览器原理',
  'cross-platform': '跨端',
  css: 'CSS',
  'design-pattern': '设计模式',
  engineering: '工程化',
  'js-principles': 'JS 原理',
  methodology: '方法论',
  'micro-frontend': '微前端',
  miniprogram: '小程序',
  nodejs: 'Node.js',
  react: 'React',
  scenario: '场景题',
  security: '安全',
  'software-design': '软件设计',
  ssr: 'SSR',
  typescript: 'TypeScript',
  vue: 'Vue',
};

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// 从 ⭐ 数推导难度
function starsToDifficulty(stars) {
  const n = stars.length;
  if (n <= 2) return '初';
  if (n === 3) return '中';
  return '高';
}

// 从引用行提取元信息:难度 + tags
function parseMetaLine(line) {
  // 形如: > ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ai-001`
  const stars = (line.match(/⭐+/) || [''])[0];
  const difficulty = starsToDifficulty(stars);
  const tags = [];
  if (line.includes('🔥高频') || line.includes('🔥 高频')) tags.push('高频');
  if (line.includes('✍️手写') || line.includes('✍️ 手写')) tags.push('手写');
  if (line.includes('💡概念') || line.includes('💡 概念')) tags.push('概念');
  return { difficulty, tags };
}

// 提取指定标签段的内容。block 是题目文本块。
// 标签形如 **💡 一句话速记**，内容到下一个 **xxx** 或块尾。
function extractFeSection(block, labelPrefix) {
  // 匹配 **<labelPrefix...>** 后的内容，直到下一个 **...** 或 --- 或块尾
  const re = new RegExp(`\\*\\*${labelPrefix}[^*]*\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n\\*\\*[^*]+\\*\\*|\\n---|$)`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

function main() {
  const text = readFileSync(SRC, 'utf-8');
  const lines = text.split('\n');

  // 第一步：找所有板块（## slug），跳过"目录"
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^##\s+(\S+)\s*$/);
    if (m && m[1] !== '目录') {
      sections.push({ slug: m[1], name: SECTION_NAMES[m[1]] || m[1], startLine: i });
    }
  }
  // 计算每个板块的结束行
  for (let idx = 0; idx < sections.length; idx++) {
    sections[idx].endLine = idx + 1 < sections.length ? sections[idx + 1].startLine : lines.length;
  }

  if (!sections.length) die('未找到任何板块(##)');

  mkdirSync(OUT_DIR, { recursive: true });

  const metaModules = [];
  let totalQuestions = 0;
  const errors = [];

  sections.forEach((section, sIdx) => {
    const modNum = String(sIdx + 1).padStart(2, '0');
    const sectionLines = lines.slice(section.startLine + 1, section.endLine);

    // 找该板块内的所有题目（### N. 标题）
    const questions = [];
    for (let i = 0; i < sectionLines.length; i++) {
      const m = sectionLines[i].match(/^###\s+(\d+)\.\s+(.+?)\s*$/);
      if (m) {
        questions.push({
          num: parseInt(m[1], 10),
          title: m[2].trim(),
          titleLine: i,
        });
      }
    }

    // 为每题计算内容块边界
    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const q = questions[qIdx];
      const blockStart = q.titleLine + 1;
      // 块到下一题或板块末尾
      let blockEnd = qIdx + 1 < questions.length ? questions[qIdx + 1].titleLine : sectionLines.length;
      // 但要在 --- 处截断（题目间分隔线）
      for (let j = blockStart; j < blockEnd; j++) {
        if (/^---\s*$/.test(sectionLines[j])) {
          blockEnd = j;
          break;
        }
      }
      q.block = sectionLines.slice(blockStart, blockEnd).join('\n');
    }

    // 生成模块文件内容
    const outLines = [`# 模块 ${modNum}：${section.name}`, ''];
    let qCount = 0;

    for (const q of questions) {
      qCount++;
      const qId = `${modNum}.${q.num}`;

      // 找引用行（> ⭐ 开头）
      const metaLine = q.block.split('\n').find((l) => l.startsWith('> ⭐'));
      let difficulty = '中';
      let tags = [];
      if (metaLine) {
        const parsed = parseMetaLine(metaLine);
        difficulty = parsed.difficulty;
        tags = parsed.tags;
      } else {
        errors.push(`${section.slug} Q${qId}: 缺少难度引用行(> ⭐)`);
      }

      // 提取三段
      const speed = extractFeSection(q.block, '💡'); // 一句话速记 -> 考察点
      const detail = extractFeSection(q.block, '📖'); // 通俗详解
      const example = extractFeSection(q.block, '🔧'); // 示例/代码
      const followup = extractFeSection(q.block, '🔍'); // 常见追问

      if (speed === null) errors.push(`${section.slug} Q${qId}: 缺少 💡 一句话速记`);
      if (detail === null) errors.push(`${section.slug} Q${qId}: 缺少 📖 通俗详解`);

      // 组装难度标签
      const tagStr = tags.length ? `·${tags.join('·')}` : '';
      outLines.push(`### Q${qId}【${difficulty}${tagStr}】${q.title}`);
      outLines.push('');
      outLines.push(`**考察点:** ${speed || ''}`);
      outLines.push('');
      outLines.push('**参考答案要点:**');
      // 通俗详解 + 示例合并为答案
      const answerParts = [];
      if (detail) answerParts.push(detail);
      if (example) answerParts.push(`**示例:**\n${example}`);
      outLines.push(answerParts.join('\n\n') || '');
      outLines.push('');

      if (followup) {
        outLines.push('**追问方向:**');
        outLines.push(followup);
        outLines.push('');
      }

      outLines.push('---');
      outLines.push('');
    }

    const fileName = `${modNum}-${section.slug}.md`;
    writeFileSync(join(OUT_DIR, fileName), outLines.join('\n'), 'utf-8');
    metaModules.push({ id: modNum, name: section.name, slug: section.slug });
    totalQuestions += qCount;
    console.log(`  ${modNum}-${section.slug}.md: ${qCount} 题`);
  });

  if (errors.length) {
    console.error('\n转换警告(不阻断，但需检查):');
    for (const e of errors) console.error(`  ! ${e}`);
  }

  // 生成 meta.yaml
  const metaLines = [
    'slug: fe',
    'name: 前端工程师',
    'description: 前端工程师面试题库，按知识板块分组，覆盖 JS 原理、框架、浏览器、工程化等。',
    'modules:',
  ];
  for (const m of metaModules) {
    metaLines.push(`  - id: ${m.id}`);
    metaLines.push(`    name: ${m.name}`);
  }
  writeFileSync(join(OUT_DIR, 'meta.yaml'), metaLines.join('\n') + '\n', 'utf-8');

  console.log(`\n✓ 转换完成: ${metaModules.length} 模块, ${totalQuestions} 题`);
  console.log(`  输出目录: ${OUT_DIR}`);
}

main();
