/*
 * clean.mjs
 *
 * 清洗管线：读原料文件 + PROMPT.md -> 调用 LLM -> 校验输出 -> 落盘 YAML。
 *
 * 这是清洗脚手架。实际 LLM 调用需要配置 API key 和 endpoint。
 * 当前版本：读原料、拼 prompt、输出待发送内容，人工或外部流程完成 LLM 调用后跑 build.mjs 校验。
 *
 * Usage: node clean.mjs <原料文件> <目标slug> [模块号]
 *   node clean.mjs docs/fe.md fe 1
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const PROMPT_PATH = join(__dirname, 'PROMPT.md');

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function main() {
  const [sourceFile, slug, moduleNum] = process.argv.slice(2);

  if (!sourceFile || !slug) {
    die('Usage: node clean.mjs <原料文件> <目标slug> [模块号]\n  例: node clean.mjs docs/fe.md fe 1');
  }

  const srcPath = resolve(sourceFile);
  if (!existsSync(srcPath)) die(`原料文件不存在: ${srcPath}`);

  const prompt = readFileSync(PROMPT_PATH, 'utf-8');
  const source = readFileSync(srcPath, 'utf-8');

  // 拼接完整清洗指令
  const fullPrompt = `${prompt}

---

## 待清洗原料

（目标分类 slug: ${slug}${moduleNum ? `，模块号: ${moduleNum}` : ''}）

${source}

---

请输出清洗后的 YAML。`;

  // 输出到 sources 目录，供 LLM 调用
  const outDir = join(__dirname, 'sources');
  mkdirSync(outDir, { recursive: true });
  const outName = `${slug}-${moduleNum || 'all'}-prompt.txt`;
  const outPath = join(outDir, outName);
  writeFileSync(outPath, fullPrompt, 'utf-8');

  console.log(`✓ 清洗 prompt 已生成: ${outPath}`);
  console.log(`  原料: ${srcPath} (${source.length} 字符)`);
  console.log(`  分类: ${slug}${moduleNum ? ` / 模块 ${moduleNum}` : ''}`);
  console.log('');
  console.log('下一步:');
  console.log('  1. 把 prompt 文件发给 LLM（或配置 API key 后本脚本自动调用）');
  console.log('  2. LLM 输出的 YAML 保存到 banks/<slug>/NN-xxx.yaml');
  console.log('  3. 更新 banks/<slug>/meta.yaml 的 modules 清单');
  console.log('  4. 跑 node quiz-app/scripts/build.mjs 校验');
}

main();
