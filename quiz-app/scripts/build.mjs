/*
 * build.mjs  (用 tsx 跑,以 import TS 共享校验模块)
 *
 * 扫描 banks 下各分类 meta.yaml，读模块 YAML 题库，
 * 校验 + 合并输出 quiz-app/public/questions.json。
 * 替代 parse-questions.mjs（不再做 md 文本切分）。
 *
 * 严格模式：任何校验失败直接 process.exit(1)。
 *
 * 校验规则抽到 src/lib/validate.ts(ADR-9 id 不可变 / ADR-10 质量闸 共享一份)。
 *
 * Usage: tsx build.mjs   (package.json: build:bank)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import {
  validateQuestion,
  checkIdImmutability,
  checkIdSegmentConsistency,
} from '../src/lib/validate.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const BANKS_DIR = join(REPO_ROOT, 'banks');
const OUT_PATH = join(__dirname, '..', 'public', 'questions.json');

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// 极简 meta.yaml 解析（复用 parse-questions.mjs 的逻辑）
function parseMetaYaml(text, file) {
  const meta = { modules: [] };
  let currentSection = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const sectionMatch = line.match(/^(\w+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (currentSection !== 'modules') meta[currentSection] = '';
      continue;
    }
    if (currentSection === 'modules' && line.startsWith('  - ')) {
      const item = {};
      const head = line.slice(4).trim();
      const m = head.match(/^(\w+):\s*(.+)$/);
      if (m) item[m[1]] = stripQuotes(m[2].trim());
      meta.modules.push(item);
      continue;
    }
    if (currentSection === 'modules' && line.startsWith('    ')) {
      const m = line.trim().match(/^(\w+):\s*(.+)$/);
      if (m && meta.modules.length) {
        meta.modules[meta.modules.length - 1][m[1]] = stripQuotes(m[2].trim());
      }
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv && !currentSection) {
      meta[kv[1]] = stripQuotes(kv[2].trim());
    }
  }
  if (!meta.slug) die(`meta.yaml 缺 slug: ${file}`);
  if (!meta.name) die(`meta.yaml 缺 name: ${file}`);
  if (!meta.modules.length) die(`meta.yaml 缺 modules: ${file}`);
  return meta;
}

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function main() {
  if (!existsSync(BANKS_DIR)) die(`banks 目录不存在: ${BANKS_DIR}`);

  const categories = [];
  const allQuestions = [];
  const seenIds = new Set();
  const allErrors = [];

  const catDirs = readdirSync(BANKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'clean' && d.name !== 'audit')
    .map((d) => d.name)
    .sort();

  if (!catDirs.length) die('banks 下没有任何分类目录');

  for (const catDir of catDirs) {
    const catPath = join(BANKS_DIR, catDir);
    const metaPath = join(catPath, 'meta.yaml');
    if (!existsSync(metaPath)) die(`分类目录缺 meta.yaml: ${catPath}`);

    const meta = parseMetaYaml(readFileSync(metaPath, 'utf-8'), metaPath);
    const { slug, name, description, modules } = meta;

    // 校验 modules 与实际 yaml 文件匹配
    const declaredIds = modules.map((m) => m.id);
    const yamlFiles = readdirSync(catPath)
      .filter((f) => /^\d{2}-[\w-]+\.yaml$/.test(f))
      .map((f) => f.slice(0, 2))
      .sort();

    const declaredSet = new Set(declaredIds);
    const actualSet = new Set(yamlFiles);
    for (const id of declaredIds) {
      if (!actualSet.has(id)) allErrors.push(`meta.yaml 声明了模块 ${id}，但 ${catDir} 下没有对应 yaml 文件`);
    }
    for (const id of yamlFiles) {
      if (!declaredSet.has(id)) allErrors.push(`${catDir} 下有 yaml 文件模块 ${id}，但 meta.yaml 未声明`);
    }

    let catQuestionCount = 0;
    const moduleCounts = [];

    for (const mod of modules) {
      const prefix = String(mod.id).padStart(2, '0');
      const fullFile = readdirSync(catPath).find(
        (f) => f.startsWith(prefix + '-') && f.endsWith('.yaml')
      );
      if (!fullFile) continue;
      const yamlPath = join(catPath, fullFile);
      let modData;
      try {
        modData = yamlLoad(readFileSync(yamlPath, 'utf-8'));
      } catch (e) {
        allErrors.push(`${fullFile}: YAML 解析失败 - ${e.message}`);
        continue;
      }

      if (!modData || !Array.isArray(modData.questions)) {
        allErrors.push(`${fullFile}: 缺少 questions 数组`);
        continue;
      }

      for (const q of modData.questions) {
        const loc = `${fullFile} Q${q.id}`;
        const fullId = `${slug}.${q.id}`;

        // 格式校验(抽到 validate.ts,与 audit/运行时共用)
        allErrors.push(...validateQuestion(q, loc));
        // 三段一致性: q.id 段须 == 文件模块号(补原先零校验的隐患)
        allErrors.push(...checkIdSegmentConsistency(q.id, mod.id, loc));

        if (seenIds.has(fullId)) allErrors.push(`id 重复: ${fullId}`);
        seenIds.add(fullId);

        allQuestions.push({
          id: fullId,
          category: slug,
          module: modData.module || parseInt(mod.id, 10),
          moduleName: modData.moduleName || mod.name,
          index: parseFloat(q.id),
          type: 'qa',
          difficulty: q.difficulty,
          tags: q.tags || [],
          title: q.title,
          focus: q.focus || '',
          answer: q.answer || [],
          followups: q.followups || [],
        });
        catQuestionCount++;
      }
      moduleCounts.push({
        id: modData.module || parseInt(mod.id, 10),
        name: modData.moduleName || mod.name,
        count: modData.questions.length,
      });
    }

    categories.push({
      slug,
      name,
      description: description || '',
      modules: moduleCounts,
      count: catQuestionCount,
    });
  }

  // id 不可变校验(ADR-9): 写入前对比历史 questions.json 的 id 集合。
  // 历史 baseline 有、而新集合没有的 id = 被删除/改名,直接报错(保护用户复习进度)。
  // 允许新增,只拦消失。首次构建(无历史文件)跳过。
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
      const baselineIds = (prev.questions || []).map((qq) => qq.id);
      const newIds = allQuestions.map((qq) => qq.id);
      allErrors.push(...checkIdImmutability(newIds, baselineIds));
    } catch {
      // 历史 questions.json 损坏:不阻断,跳过不可变校验(视为无 baseline)
    }
  }

  if (allErrors.length) {
    console.error('构建失败，以下问题需修复:\n');
    for (const e of allErrors) console.error(`  ✗ ${e}`);
    console.error(`\n共 ${allErrors.length} 个错误。`);
    process.exit(1);
  }

  const output = { categories, questions: allQuestions, total: allQuestions.length };
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`✓ 构建成功`);
  for (const c of categories) {
    console.log(`  ${c.name} (${c.slug}): ${c.modules.length} 模块, ${c.count} 题`);
  }
  console.log(`  合计 ${allQuestions.length} 题`);
  console.log(`  输出: ${OUT_PATH}`);
}

main();
