import { randomUUID } from 'node:crypto';
import { createPool, migrate } from './db.mjs';
import { passwordHash } from './auth.mjs';
import { text } from './validation.mjs';

async function secretPrompt() {
  if (!process.stdin.isTTY) throw new Error('Execute em um terminal interativo (-it); a senha não deve ir em argumentos ou variáveis.');
  process.stdout.write('Senha (mínimo 12 caracteres, entrada oculta): ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const done = (error) => {
      process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\u0003') return done(new Error('Cancelado.'));
        if (char === '\r' || char === '\n') return done();
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}
const login = text(process.argv[2], 'Login', 3, 100).toLowerCase();
const name = text(process.argv[3] || login, 'Nome', 2, 150);
const password = await secretPrompt();
if (password.length < 12 || password.length > 200) throw new Error('A senha precisa ter de 12 a 200 caracteres.');
const pool = createPool();
try {
  await migrate(pool);
  await pool.query('INSERT INTO app_users(id, login, display_name, password_hash) VALUES ($1,$2,$3,$4)', [randomUUID(), login, name, await passwordHash(password)]);
  console.log(`Usuário ${login} criado.`);
} finally { await pool.end(); }
