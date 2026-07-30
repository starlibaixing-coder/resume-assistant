/*
 * parse-questions.mjs
 *
 * 扫描 banks 下的各分类 meta.yaml，严格解析 Markdown 题库，
 * 聚合输出 quiz-app/public/questions.json。
 *
 * 严格模式：任何格式不符直接 process.exit(1)，让 CI 变红。
 *
 * Usage: node parse-questions.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const BANKS_DIR = join(REPO_ROOT, 'banks');
const OUT_PATH = join(__dirname, '..', 'public', 'questions.json');

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// 极简 YAML 解析：只处理 meta.yaml 这种扁平 key: value + modules 列表结构。
// 不引入 yaml 依赖，避免给 skill 目录加 node_modules。
function parseMetaYaml(text, file) {
  const meta = { modules: [] };
  let currentSection = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // modules: 开启列表段
    const sectionMatch = line.match(/^(\w+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (currentSection !== 'modules') {
        meta[currentSection] = '';
      }
      continue;
    }

    // 列表项 "- id: 01" / "  name: Agent 核心机制"
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

    // 普通顶层 key: value
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv && !currentSection) {
      meta[kv[1]] = stripQuotes(kv[2].trim());
    }
  }
  // 收尾
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

// ---------------------------------------------------------------------------
// 难度归一
// ---------------------------------------------------------------------------

// 标签按 · 或 · 分段，首段判主难度，其余存 tags。
function normalizeDifficulty(rawTag) {
  // rawTag 形如 "中" / "高·必问" / "中高·必问" / "必问" / "建议准备"
  const parts = rawTag.split(/[·]/).map((s) => s.trim()).filter(Boolean);
  const primary = parts[0] || '';
  const tags = parts.slice(1);

  let difficulty;
  if (primary === '初') difficulty = '初';
  else if (primary === '中') difficulty = '中';
  else if (primary === '高' || primary === '中高') difficulty = '高';
  else {
    // "必问" / "建议准备" 等无难度词 -> 归中
    difficulty = '中';
    // 主段本身也作为 tag 保留
    tags.unshift(primary);
  }
  return { difficulty, tags };
}

// ---------------------------------------------------------------------------
// 单题解析
// ---------------------------------------------------------------------------

// 匹配 Q01.1 或 Q13.4.5 这种带子题号的格式。idxStr 含完整题号(如 "4.5")。
const TITLE_RE = /^###\s+Q(\d{2})\.(\d+(?:\.\d+)?)\s*【([^】]+)】\s*(.+?)\s*$/;

function parseQuestionsFromMd(text, mdFile, categorySlug, moduleName) {
  const lines = text.split('\n');
  const questions = [];
  let i = 0;
  const errors = [];

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(TITLE_RE);
    if (!m) {
      i++;
      continue;
    }

    const [, modStr, idxStr, rawTag, title] = m;
    const module = parseInt(modStr, 10);
    const index = parseFloat(idxStr);  // 支持 4.5 子题号
    const id = `${categorySlug}.${modStr}.${idxStr}`;
    const { difficulty, tags } = normalizeDifficulty(rawTag);

    // 收集题块：直到下一个 ### Q 或 ## 或文件末尾
    const blockStart = i + 1;
    let blockEnd = blockStart;
    while (blockEnd < lines.length) {
      const l = lines[blockEnd];
      if (l.startsWith('### Q') || l.startsWith('## ')) break;
      blockEnd++;
    }
    const block = lines.slice(blockStart, blockEnd).join('\n');

    // 提取三段。冒号兼容全角：和半角:
    const focus = extractSection(block, '考察点');
    const answer = extractSection(block, '参考答案要点');
    const followups = extractSection(block, '追问方向');

    const loc = `${mdFile} Q${modStr}.${idxStr}`;
    if (focus === null) errors.push(`${loc}: 缺少 **考察点:** 段`);
    if (answer === null) errors.push(`${loc}: 缺少 **参考答案要点:** 段`);
    // followups 可空：extractSection 返回 null 表示该段不存在，正常

    questions.push({
      id,
      category: categorySlug,
      module,
      moduleName,
      index,
      type: 'qa',
      difficulty,
      tags,
      title: title.trim(),
      focus: focus || '',
      answer: answer ? splitBullets(answer) : [],
      followups: followups ? splitBullets(followups) : [],
    });

    i = blockEnd;
  }

  return { questions, errors };
}

// 从 block 中提取 "**标签：** 内容" 段，内容延续到下一个 **xxx:** 或段尾。
// 冒号兼容全角：和半角:。标签后可能带括号说明，如 **参考答案要点(关键:按 token):**
// 返回内容字符串，段不存在返回 null。
function extractSection(block, label) {
  // 括号内容允许除换行和右括号外的任意字符(含冒号)；兼容半角()和全角（）
  // 末尾兼容冒号在内 ):** 和冒号在外 )**: 两种顺序
  // 前瞻也要兼容冒号在内 :** 和在外 **: 两种顺序(下一段标签可能是任一写法)
  const re = new RegExp(`\\*\\*${label}(?:\\s*[（(][^\\n)）]*[)）])?\\s*(?:[：:]\\*\\*|\\*\\*[：:])\\s*([\\s\\S]*?)(?=\\n\\*\\*[^*]+(?:[：:]\\*\\*|\\*\\*[：:])|$)`);
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

// 把段落按 bullet 拆成数组；若无 bullet 则按行拆。
function splitBullets(text) {
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  // 过滤掉 Markdown 水平分隔线(---/***/___)
  const content = lines.filter((l) => !/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l.trim()));
  const bullets = content.filter((l) => /^[-*]\s+/.test(l.trim()));
  if (bullets.length) {
    return bullets.map((l) => l.trim().replace(/^[-*]\s+/, ''));
  }
  // 无 bullet，按非空行拆
  return content.filter((l) => l.trim());
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(BANKS_DIR)) die(`banks 目录不存在: ${BANKS_DIR}`);

  const categories = [];
  const allQuestions = [];
  const seenIds = new Set();
  const allErrors = [];

  const catDirs = readdirSync(BANKS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (!catDirs.length) die('banks 下没有任何分类目录');

  for (const catDir of catDirs) {
    const catPath = join(BANKS_DIR, catDir);
    const metaPath = join(catPath, 'meta.yaml');
    if (!existsSync(metaPath)) die(`分类目录缺 meta.yaml: ${catPath}`);

    const meta = parseMetaYaml(readFileSync(metaPath, 'utf-8'), metaPath);
    const { slug, name, description, modules } = meta;

    // 校验 modules 与实际 md 文件严格匹配
    const declaredIds = modules.map((m) => m.id);
    const mdFiles = readdirSync(catPath)
      .filter((f) => /^\d{2}-[\w-]+\.md$/.test(f))
      .map((f) => f.slice(0, 2))
      .sort();

    const declaredSet = new Set(declaredIds);
    const actualSet = new Set(mdFiles);
    for (const id of declaredIds) {
      if (!actualSet.has(id)) allErrors.push(`meta.yaml 声明了模块 ${id}，但 banks/${catDir} 下没有对应 md 文件`);
    }
    for (const id of mdFiles) {
      if (!declaredSet.has(id)) allErrors.push(`banks/${catDir} 下有 md 文件模块 ${id}，但 meta.yaml 未声明`);
    }

    // 解析每个模块
    let catQuestionCount = 0;
    const moduleCounts = [];
    for (const mod of modules) {
      const modFile = mdFiles.find((f) => f === mod.id);
      if (!modFile) continue; // 上面已报错
      const fullFile = readdirSync(catPath).find((f) => f.startsWith(`${mod.id}-`) && f.endsWith('.md'));
      const mdPath = join(catPath, fullFile);
      const text = readFileSync(mdPath, 'utf-8');
      const { questions, errors } = parseQuestionsFromMd(text, fullFile, slug, mod.name);
      allErrors.push(...errors);

      for (const q of questions) {
        if (seenIds.has(q.id)) {
          allErrors.push(`id 重复: ${q.id}`);
        }
        seenIds.add(q.id);
        allQuestions.push(q);
        catQuestionCount++;
      }
      moduleCounts.push({ id: parseInt(mod.id, 10), name: mod.name, count: questions.length });
    }

    categories.push({ slug, name, description: description || '', modules: moduleCounts, count: catQuestionCount });
  }

  // 汇总错误
  if (allErrors.length) {
    console.error('解析失败，以下问题需修复:\n');
    for (const e of allErrors) console.error(`  ✗ ${e}`);
    console.error(`\n共 ${allErrors.length} 个错误。`);
    process.exit(1);
  }

  const output = { categories, questions: allQuestions, total: allQuestions.length };
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`✓ 解析成功`);
  for (const c of categories) {
    console.log(`  ${c.name} (${c.slug}): ${c.modules.length} 模块, ${c.count} 题`);
  }
  console.log(`  合计 ${allQuestions.length} 题`);
  console.log(`  输出: ${OUT_PATH}`);
}

main();
