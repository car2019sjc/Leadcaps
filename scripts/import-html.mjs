import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, validatePack } from './build.mjs';

export function extractPack(html) {
  const marker = 'const PACK =';
  const position = html.indexOf(marker);
  if (position < 0) throw new Error('Não encontrei a base incorporada neste HTML.');
  let start = position + marker.length;
  while (/\s/.test(html[start] || '') && start < html.length) start++;
  if (html[start] !== '{') throw new Error('A base incorporada precisa ser um objeto JSON.');
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') {
      depth--;
      if (!depth) {
        const pack = JSON.parse(html.slice(start, i + 1));
        validatePack(pack);
        return pack;
      }
    }
  }
  throw new Error('A base JSON está incompleta.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) throw new Error('Use npm run import:html -- "caminho/arquivo.html"');
  const bytes = await readFile(resolve(path));
  const html = bytes.toString('utf8');
  const pack = extractPack(html);
  const directory = resolve(root, 'data/private');
  const reference = resolve(root, 'reference/private');
  await mkdir(directory, { recursive: true });
  await mkdir(reference, { recursive: true });
  await writeFile(resolve(directory, 'base.pack.json'), JSON.stringify(pack) + '\n');
  const baseDate = html.match(/const BASE_DATE\s*=\s*['"]([0-9-]+)['"]/m)?.[1] || null;
  await writeFile(resolve(directory, 'base.metadata.json'), JSON.stringify({
    records: pack.cols.n.length, base_date: baseDate,
    source_file: basename(path), source_sha256: createHash('sha256').update(bytes).digest('hex'),
  }, null, 2) + '\n');
  if (resolve(path) !== resolve(reference, basename(path))) await copyFile(resolve(path), resolve(reference, basename(path)));
  console.log(`Base local extraída: ${pack.cols.n.length} contatos. Pastas privadas permanecem fora do Git.`);
}
