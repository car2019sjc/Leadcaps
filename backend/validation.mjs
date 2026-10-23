export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function text(value, label, min = 1, max = 300) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, `${label}: informe entre ${min} e ${max} caracteres.`);
  }
  return value.trim();
}

// Contrato v1 do console: valida também os índices usados pelo hydrate do frontend.
export function validateImport(input) {
  const description = text(input?.description, 'Descrição da base', 5, 500);
  const filename = text(input?.filename, 'Nome do arquivo', 1, 255);
  if (!/^[0-9a-f]{64}$/i.test(input.source_sha256 || '')) throw new HttpError(400, 'Hash do arquivo inválido.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.request_id || '')) throw new HttpError(400, 'Identificador da carga inválido.');
  const pack = input.pack, D = pack?.dic, C = pack?.cols;
  if (!D || !C || !Array.isArray(C.n) || C.n.length < 1 || C.n.length > 100000) {
    throw new HttpError(400, 'A base deve conter entre 1 e 100.000 contatos.');
  }
  const count = C.n.length;
  const strings = ['n', 't', 'c', 'el', 'li'];
  const numbers = ['em', 'rev', 'sc', 'fl'];
  const refs = { f: 'fam', s: 'sen', pt: 'porte', ind: 'ind', ci: 'cid', uf: 'uf', d: 'dom', dp: 'dcombo', est: 'est', reg: 'reg' };
  for (const key of [...strings, ...numbers, 'pc', ...Object.keys(refs)]) {
    if (!Array.isArray(C[key]) || C[key].length !== count) throw new HttpError(400, `Coluna inválida: ${key}.`);
  }
  for (const key of [...Object.values(refs), 'dept']) {
    if (!Array.isArray(D[key]) || D[key].length > 100000) throw new HttpError(400, `Dicionário inválido: ${key}.`);
    if (key !== 'dcombo' && D[key].some(x => typeof x !== 'string' || x.length > 4096)) throw new HttpError(400, `Valor inválido: ${key}.`);
  }
  if (D.dcombo.some(xs => !Array.isArray(xs) || xs.some(x => !Number.isInteger(x) || x < 0 || x >= D.dept.length))) {
    throw new HttpError(400, 'Índice de departamento inválido.');
  }
  for (let i = 0; i < count; i++) {
    for (const key of strings) if (typeof C[key][i] !== 'string' || C[key][i].length > 4096) throw new HttpError(400, `Texto inválido na linha ${i + 1}.`);
    for (const key of numbers) if (typeof C[key][i] !== 'number' || !Number.isFinite(C[key][i])) throw new HttpError(400, `Número inválido na linha ${i + 1}.`);
    if (!Array.isArray(C.pc[i]) || C.pc[i].length !== 6 || C.pc[i].some(x => typeof x !== 'number' || !Number.isFinite(x))) throw new HttpError(400, `Componentes de score inválidos na linha ${i + 1}.`);
    for (const [key, dict] of Object.entries(refs)) {
      if (!Number.isInteger(C[key][i]) || C[key][i] < 0 || C[key][i] >= D[dict].length) throw new HttpError(400, `Referência inválida na linha ${i + 1}.`);
    }
  }
  // Copia somente campos conhecidos; o servidor não confia em contagens ou datas do cliente.
  const cleanPack = { dic: Object.fromEntries([...Object.values(refs), 'dept'].map(k => [k, D[k]])),
    cols: Object.fromEntries([...strings, ...numbers, 'pc', ...Object.keys(refs)].map(k => [k, C[k]])) };
  return { description, filename, source_sha256: input.source_sha256.toLowerCase(), request_id: input.request_id.toLowerCase(), pack: cleanPack, record_count: count };
}
