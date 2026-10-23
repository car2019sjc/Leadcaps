import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './build.mjs';

let count = 0;
for (const folder of ['src/js', 'scripts', 'tests', 'backend']) {
  for (const file of await readdir(resolve(root, folder))) {
    if (!/\.m?js$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', resolve(root, folder, file)], { encoding: 'utf8' });
    if (result.status) { console.error(result.stderr); process.exit(1); }
    count++;
  }
}
const app = await readFile(resolve(root, 'src/js/app.js'), 'utf8');
if (!/let IA_KEY = ''/.test(app)) throw new Error('A chave de API deve iniciar vazia.');
const template = await readFile(resolve(root, 'src/template.html'), 'utf8');
if (/const PACK\s*=/.test(template)) throw new Error('A base não deve ficar no template.');
console.log(`${count} arquivos JavaScript com sintaxe válida; base e credencial separadas do template.`);
