/*
 * migrate.mjs
 *
 * 把现有 questions.json (md 解析产物) 迁移成 YAML 题库源文件。
 * 输出: banks/<slug>/<NN>-<name>.yaml + 保留 meta.yaml
 *
 * Usage: node migrate.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SRC = join(REPO_ROOT, 'quiz-app', 'public', 'questions.json');

// YAML 字符串转义：含特殊字符的用双引号包裹
function yamlStr(s) {
  if (s == null) return '""';
  // 含冒号、#、引号、换行、首尾空格、特殊字符的用双引号
  if (/[:#"'{}\[\],&*?|<>%@`]/.test(s) || /^\s|\s$/.test(s) || s.includes('\n')) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  return s;
}

function questionToYaml(q, indent = '  ') {
  const lines = [];
  lines.push(`${indent}- id: "${q.id.split('.').slice(1).join('.')}"`);
  lines.push(`${indent}  difficulty: ${yamlStr(q.difficulty)}`);
  lines.push(`${indent}  tags: ${q.tags.length ? '[' + q.tags.map((t) => yamlStr(t)).join(', ') + ']' : '[]'}`);
  lines.push(`${indent}  title: ${yamlStr(q.title)}`);
  lines.push(`${indent}  focus: ${yamlStr(q.focus)}`);
  lines.push(`${indent}  answer:`);
  if (q.answer.length === 0) {
    lines.push(`${indent}  - ""`);
  } else {
    for (const a of q.answer) {
      lines.push(`${indent}  - ${yamlStr(a)}`);
    }
  }
  lines.push(`${indent}  followups:`);
  if (q.followups.length === 0) {
    lines.push(`${indent}  - ""`);
  } else {
    for (const f of q.followups) {
      lines.push(`${indent}  - ${yamlStr(f)}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const data = JSON.parse(readFileSync(SRC, 'utf-8'));

  // 建立 slug -> 目录路径映射（扫 banks/*/meta.yaml）
  const bankDirs = readdirSync(join(REPO_ROOT, 'banks'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const slugToDir = {};
  for (const dir of bankDirs) {
    const metaPath = join(REPO_ROOT, 'banks', dir, 'meta.yaml');
    if (existsSync(metaPath)) {
      const metaText = readFileSync(metaPath, 'utf-8');
      const slugMatch = metaText.match(/^slug:\s*(.+)$/m);
      if (slugMatch) slugToDir[slugMatch[1].trim()] = dir;
    }
  }

  for (const cat of data.categories) {
    const actualDir = join(REPO_ROOT, 'banks', slugToDir[cat.slug] || cat.slug);

    const catQuestions = data.questions.filter((q) => q.category === cat.slug);

    for (const mod of cat.modules) {
      const modQuestions = catQuestions
        .filter((q) => q.module === mod.id)
        .sort((a, b) => a.index - b.index);

      // 推导文件名 slug：从现有 md 文件名取
      const prefix = String(mod.id).padStart(2, '0');
      let fileSlug = prefix;
      if (existsSync(actualDir)) {
        const files = readdirSync(actualDir);
        const match = files.find((f) => f.startsWith(prefix + '-') && (f.endsWith('.md') || f.endsWith('.yaml')));
        if (match) fileSlug = match.slice(3).replace(/\.(md|yaml)$/, '');
      }

      const yamlLines = [
        `module: ${mod.id}`,
        `moduleName: ${yamlStr(mod.name)}`,
        `questions:`,
      ];
      for (const q of modQuestions) {
        yamlLines.push(questionToYaml(q));
      }

      const outPath = join(actualDir, `${prefix}-${fileSlug}.yaml`);
      writeFileSync(outPath, yamlLines.join('\n') + '\n', 'utf-8');
      console.log(`  ${cat.slug}/${prefix}-${fileSlug}.yaml: ${modQuestions.length} 题`);
    }
  }

  console.log('\n✓ 迁移完成');
}

main();
