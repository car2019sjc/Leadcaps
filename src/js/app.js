

/* fonte original preservada para gerar uma nova versão do app com a base atualizada */
const SELF_HEAD = document.head.outerHTML;
const SELF_BODY = document.body.innerHTML;

/* ───────────────── hidratação ───────────────── */
const BASE_DATE = '__BASE_DATE__'; /*DATE_END*/
const APP_BUILD = '__APP_BUILD__';   /* versão do CÓDIGO; a regeneração a preserva */
const LIBASE = 'http://www.linkedin.com/in/';
let ROWS = [];
let SOURCE = null;   // null = base embutida
function hydrate(pack) {
const D = pack.dic, C = pack.cols;
const rows = C.n.map((n, i) => {
  const fl = C.fl[i], dom = D.dom[C.d[i]], li = C.li[i];
  return {
    i, n, t: C.t[i], c: C.c[i],
    e: C.el[i] ? (dom ? C.el[i] + '@' + dom : C.el[i]) : '',
    dom,
    f: D.fam[C.f[i]], sen: D.sen[C.s[i]], pt: D.porte[C.pt[i]],
    ind: D.ind[C.ind[i]], ci: D.cid[C.ci[i]], uf: D.uf[C.uf[i]],
    est: D.est[C.est[i]], reg: D.reg[C.reg[i]],
    dp: D.dcombo[C.dp[i]].map(x => D.dept[x]),
    em: C.em[i] < 0 ? null : C.em[i],
    rev: (C.rev && C.rev[i] >= 0) ? C.rev[i] : null,
    li: li ? (li[0] === '!' ? li.slice(1) : LIBASE + li) : '',
    sc: C.sc[i], pc: C.pc[i],
    tr: C.sc[i] >= 86 ? 'A' : (C.sc[i] >= 72 ? 'B' : 'C'),
    corp: !!(fl & 1), ti: !!(fl & 2), br: !!(fl & 4), dup: !!(fl & 8),
  };
});
return rows;
}
function indexRows(rows) {
  rows.forEach(r => {
    if (!r.revb) r.revb = ING.faixaOf(r.rev === undefined ? null : r.rev);
    r.loc = r.ci ? r.ci + (r.uf ? '/' + r.uf : '') : (r.uf || '');
    r.k = (r.n + ' ' + r.t + ' ' + r.c + ' ' + r.e + ' ' + r.ind + ' ' + r.loc)
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    r.tk = r.t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  });
  return rows;
}
ROWS = indexRows(hydrate(PACK));
let HAS_REV = false;
function checkRev() {
  HAS_REV = ROWS.some(r => r.rev !== null && r.rev !== undefined);
  document.body.classList.toggle('no-rev', !HAS_REV);
}
const FAIXA_ORD = ['Até 1 mi', '1 – 10 mi', '10 – 50 mi', '50 – 200 mi', '200 mi – 1 bi', '1 – 10 bi', 'Acima de 10 bi', 'Não informado'];
function fmtRev(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e9) return 'US$ ' + (n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' bi';
  if (n >= 1e6) return 'US$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (n >= 1e3) return 'US$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
  return 'US$ ' + fmt(n);
}
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fmt = n => (n === null || n === undefined || n === '') ? '—' : n.toLocaleString('pt-BR');
const $ = s => document.querySelector(s);

/* ───────────────── estado ───────────────── */
const BLANK = () => ({ q: '', tr: new Set(), f: new Set(), ind: new Set(), pt: new Set(), revb: new Set(), reg: new Set(), est: new Set(), ci: new Set(), dp: new Set(), flags: new Set(), emin: null, emax: null, rmin: null, rmax: null,
  exc: { f: new Set(), sen: new Set(), ind: new Set(), pt: new Set(), revb: new Set(), reg: new Set(), est: new Set(), ci: new Set(), dp: new Set() },
  exq: [], exqn: [] });
const EXLBL = { f: 'Cargo', sen: 'Senioridade', ind: 'Setor', pt: 'Porte', revb: 'Faturamento (USD)', reg: 'Região', est: 'Estado', ci: 'Município', dp: 'Departamento' };
let F = BLANK();
let sortK = 'sc', sortDir = 'desc', page = 1, pageSize = 50;
const SEL = new Set();

const FLAGS = [
  { k: 'corp', l: 'Só e-mail corporativo', fn: r => r.corp },
  { k: 'ti', l: 'Só decisores de TI', fn: r => r.ti },
  { k: 'li', l: 'Só com LinkedIn', fn: r => !!r.li },
  { k: 'br', l: 'Só contatos no Brasil', fn: r => r.br },
  { k: 'nodup', l: 'Ocultar e-mails duplicados', fn: r => !r.dup },
  { k: 'oneper', l: 'Um contato por empresa', fn: () => true },
];

const NIVEIS = [
  { n: 1, t: 'Alvo prioritário', d: 'recortes prontos para cadência imediata' },
  { n: 2, t: 'Alta aderência', d: 'setores com dependência crítica de infraestrutura' },
  { n: 3, t: 'Aderência média', d: 'setores com demanda recorrente, ciclo mais longo' },
  { n: 4, t: 'Cobertura ampla', d: 'demais setores da base, para varredura' },
];
const PRESETS = [
  // ── Nível 1 — alvo prioritário
  { n: 1, l: 'Decisores de TI · grandes contas', s: { f: ['CIO / CTO / TI', 'CISO / Segurança'], pt: ['Grande (1.000–4.999)', 'Corporação (5.000–19.999)', 'Mega corporação (20.000+)'], flags: ['corp'] } },
  { n: 1, l: 'Prioridade A · pronto para cadência', s: { tr: ['A'], flags: ['corp', 'li', 'nodup', 'oneper'] } },
  { n: 1, l: 'CIOs e CTOs · corporações', s: { f: ['CIO / CTO / TI'], pt: ['Corporação (5.000–19.999)', 'Mega corporação (20.000+)'] } },
  { n: 1, l: 'CFOs · pauta de custo de TI', s: { f: ['CFO / Financeiro'], tr: ['A'], flags: ['corp'] } },
  { n: 1, l: 'CISOs e segurança', s: { f: ['CISO / Segurança'] } },
  { n: 1, l: 'Vale do Paraíba e Campinas', s: { ci: ['São José dos Campos', 'Jacareí', 'Taubaté', 'Caçapava', 'Pindamonhangaba', 'Cruzeiro', 'Campinas'] } },
  { n: 1, l: 'Uma conta, um decisor', s: { flags: ['oneper', 'corp'] } },
  // ── Nível 2 — alta aderência setorial
  { n: 2, l: 'Tecnologia, software e telecom', s: { g: 'ti' } },
  { n: 2, l: 'Bancos, seguros e finanças', s: { g: 'fin' } },
  { n: 2, l: 'Saúde, hospitais e farmacêutico', s: { g: 'saude' } },
  { n: 2, l: 'Varejo, atacado e consumo', s: { g: 'varejo' } },
  { n: 2, l: 'Logística, transporte e armazenagem', s: { g: 'log' } },
  { n: 2, l: 'Indústria e manufatura', s: { g: 'ind' } },
  { n: 2, l: 'Energia, óleo, gás e mineração', s: { g: 'energia' } },
  { n: 2, l: 'Setor público e defesa', s: { g: 'gov' } },
  // ── Nível 3 — aderência média
  { n: 3, l: 'Agronegócio e alimentos', s: { g: 'agro' } },
  { n: 3, l: 'Construção e engenharia', s: { g: 'constr' } },
  { n: 3, l: 'Educação', s: { g: 'edu' } },
  { n: 3, l: 'Serviços corporativos e terceirização', s: { g: 'serv' } },
  // ── Nível 4 — cobertura ampla
  { n: 4, l: 'Moda, têxtil e cosméticos', s: { g: 'moda' } },
  { n: 4, l: 'Mídia, marketing e entretenimento', s: { g: 'midia' } },
  { n: 4, l: 'Hotelaria, turismo e lazer', s: { g: 'turismo' } },
  { n: 4, l: 'Terceiro setor e associações', s: { g: 'social' } },
  { n: 4, l: 'Setores não agrupados', s: { g: '*' } },
];
let NIVEL = 1;
/* um grupo vira a lista de setores que existem de fato na base carregada */
function setoresDoGrupo(g) {
  const G = ING.GRUPOS;
  const presentes = new Set(ROWS.map(r => r.ind).filter(Boolean));
  const out = [];
  presentes.forEach(lbl => {
    const k = ING.canonSec(lbl);
    if (g === '*') {
      let achou = false;
      for (const gg in G) if (G[gg].k.includes(k)) { achou = true; break; }
      if (!achou) out.push(lbl);
    } else if (G[g] && G[g].k.includes(k)) out.push(lbl);
  });
  return out;
}
function criterios(p) {
  const s = Object.assign({}, p.s);
  if (s.g) { s.ind = setoresDoGrupo(s.g); delete s.g; }
  return s;
}
/* quantos contatos o recorte entrega, sem alterar o estado atual */
function contaPreset(p) {
  const s = criterios(p);
  const set = k => s[k] ? new Set(s[k]) : null;
  const tr = set('tr'), f = set('f'), ind = set('ind'), pt = set('pt'), ci = set('ci'), est = set('est');
  const fl = new Set(s.flags || []);
  let n = 0;
  const empresas = fl.has('oneper') ? new Set() : null;
  const base = ROWS.filter(r =>
    (!tr || tr.has(r.tr)) && (!f || f.has(r.f)) && (!ind || ind.has(r.ind)) &&
    (!pt || pt.has(r.pt)) && (!ci || ci.has(r.ci)) && (!est || est.has(r.est)) &&
    (!fl.has('corp') || r.corp) && (!fl.has('ti') || r.ti) && (!fl.has('li') || !!r.li) &&
    (!fl.has('br') || r.br) && (!fl.has('nodup') || !r.dup));
  if (!empresas) return base.length;
  base.forEach(r => { const k = r.c.toLowerCase(); if (!empresas.has(k)) { empresas.add(k); n++; } });
  return n;
}

/* ───────────────── filtro ───────────────── */
function passes(r, skip) {
  if (F.q) { for (const w of F.q) if (!r.k.includes(w)) return false; }
  if (skip !== 'tr' && F.tr.size && !F.tr.has(r.tr)) return false;
  if (skip !== 'f' && F.f.size && !F.f.has(r.f)) return false;
  if (skip !== 'ind' && F.ind.size && !F.ind.has(r.ind)) return false;
  if (skip !== 'pt' && F.pt.size && !F.pt.has(r.pt)) return false;
  if (skip !== 'reg' && F.reg.size && !F.reg.has(r.reg)) return false;
  if (skip !== 'est' && F.est.size && !F.est.has(r.est)) return false;
  if (skip !== 'ci' && F.ci.size && !F.ci.has(r.ci)) return false;
  if (F.dp.size) { let ok = false; for (const d of r.dp) if (F.dp.has(d)) { ok = true; break; } if (!ok) return false; }
  if (skip !== 'revb' && F.revb.size && !F.revb.has(r.revb)) return false;
  if (F.rmin !== null && (r.rev === null || r.rev < F.rmin)) return false;
  if (F.rmax !== null && (r.rev === null || r.rev > F.rmax)) return false;
  if (F.emin !== null && (r.em === null || r.em < F.emin)) return false;
  if (F.emax !== null && (r.em === null || r.em > F.emax)) return false;
  for (const k in F.exc) {
    if (k === skip) continue;
    const s = F.exc[k]; if (!s.size) continue;
    if (k === 'dp') { if (r.dp.some(x => s.has(x))) return false; }
    else if (s.has(r[k])) return false;
  }
  if (F.exqn.length && F.exqn.some(w => r.tk.includes(w))) return false;
  for (const fl of FLAGS) if (fl.k !== 'oneper' && F.flags.has(fl.k) && !fl.fn(r)) return false;
  return true;
}
function apply(skip) {
  let out = ROWS.filter(r => passes(r, skip));
  if (F.flags.has('oneper')) {
    const seen = new Set();
    out = out.slice().sort((a, b) => b.sc - a.sc).filter(r => {
      const key = r.c.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true;
    });
  }
  return out;
}
let VIEW = [];

function sorted(arr) {
  const dir = sortDir === 'asc' ? 1 : -1;
  return arr.slice().sort((a, b) => {
    let x = a[sortK], y = b[sortK];
    if (sortK === 'sc' || sortK === 'em' || sortK === 'rev') {
      x = (x === null || x === undefined) ? -1 : x; y = (y === null || y === undefined) ? -1 : y;
      return (x - y) * dir || a.n.localeCompare(b.n, 'pt-BR');
    }
    return String(x).localeCompare(String(y), 'pt-BR') * dir;
  });
}

/* ───────────────── facetas do rail ───────────────── */
function counts(key, skip) {
  const base = ROWS.filter(r => passes(r, skip));
  const m = new Map();
  base.forEach(r => {
    const v = r[key];
    if (Array.isArray(v)) v.forEach(x => m.set(x, (m.get(x) || 0) + 1));
    else if (v !== '' && v !== null) m.set(v, (m.get(v) || 0) + 1);
  });
  return m;
}
const FACETS = [
  { id: 'f-f', key: 'f', set: 'f', limit: 20 },
  { id: 'f-ind', key: 'ind', set: 'ind', limit: 12 },
  { id: 'f-pt', key: 'pt', set: 'pt', limit: 20 },
  { id: 'f-revb', key: 'revb', set: 'revb', limit: 10, order: FAIXA_ORD },
  { id: 'f-est', key: 'est', set: 'est', limit: 8 },
  { id: 'f-ci', key: 'ci', set: 'ci', limit: 10, search: 'cisearch', bulk: true },
  { id: 'f-dp', key: 'dp', set: 'dp', limit: 12 },
];
const expanded = {};
function renderFacets() {
  FACETS.forEach(fc => {
    const m = counts(fc.key, fc.set);
    const sel = F[fc.set];
    let list = [...m.entries()].sort((a, b) => fc.order
      ? fc.order.indexOf(a[0]) - fc.order.indexOf(b[0])
      : (b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')));
    sel.forEach(v => { if (!m.has(v)) list.unshift([v, 0]); });
    (F.exc[fc.set] || new Set()).forEach(v => { if (!m.has(v)) list.unshift([v, 0]); });
    let hint = '';
    if (fc.search) {
      const inp = document.getElementById(fc.search);
      const qq = inp ? norm(inp.value.trim()) : '';
      const total = list.length;
      if (qq) { list = list.filter(([v]) => norm(v).includes(qq) || sel.has(v)); hint = `${list.length} de ${total}`; }
    }
    const showAll = expanded[fc.set] || (fc.search && document.getElementById(fc.search) && document.getElementById(fc.search).value.trim());
    const shown = showAll ? list : list.slice(0, fc.limit);
    const box = document.getElementById(fc.id);
    const exc = F.exc[fc.set] || new Set();
    box.innerHTML =
      `<div class="${list.length > 8 ? 'scrolly' : ''}">` + (shown.length ? shown.map(([v, n]) =>
        `<label class="opt${exc.has(v) ? ' opt--ex' : ''}"><input type="checkbox" data-set="${fc.set}" value="${esc(v)}"${sel.has(v) ? ' checked' : ''}><span class="opt__l" title="${esc(v)}">${esc(v || '—')}</span><span class="opt__n">${fmt(n)}</span>` +
        (F.exc[fc.set] ? `<button class="opt__x" data-ex="${fc.set}" data-v="${esc(v)}" title="${exc.has(v) ? 'Voltar a incluir' : 'Excluir da lista'}" aria-label="${exc.has(v) ? 'Voltar a incluir' : 'Excluir'} ${esc(v)}">${exc.has(v) ? '↺' : '⊘'}</button>` : '') +
        `</label>`
      ).join('') : '<div style="font-size:12px;color:#7B93A8;padding:6px">Nenhum município com esse nome no filtro atual.</div>') + '</div>' +
      (fc.bulk && shown.length ? `<div class="bulk"><button data-bulk="${fc.set}" data-on="1">Marcar listados</button>${sel.size ? `<button data-bulk="${fc.set}" data-on="0">Limpar seleção</button>` : ''}</div>` : '') +
      (!showAll && list.length > fc.limit ? `<button class="morebtn" data-more="${fc.set}">+ ver todos (${list.length})</button>` : (expanded[fc.set] && !fc.search ? `<button class="morebtn" data-more="${fc.set}">− menos</button>` : ''));
    if (fc.id === 'f-ci') { const sc = $('#ciscope'); if (sc) sc.textContent = hint; }
    const badge = document.querySelector(`[data-n="${fc.set}"]`);
    if (badge) { const t = sel.size + (F.exc[fc.set] ? F.exc[fc.set].size : 0) + (fc.set === 'f' ? F.exq.length : 0); badge.hidden = t === 0; badge.textContent = t; }
  });
  const pm = F.pt.size + F.revb.size + F.exc.pt.size + F.exc.revb.size + (F.emin !== null || F.emax !== null ? 1 : 0) + (F.rmin !== null || F.rmax !== null ? 1 : 0);
  const pb = document.querySelector('[data-n="ptrev"]');
  if (pb) { pb.hidden = pm === 0; pb.textContent = pm; }
  const gm = F.reg.size + F.est.size + F.ci.size + F.exc.reg.size + F.exc.est.size + F.exc.ci.size;
  const gb = document.querySelector('[data-n="geo"]');
  if (gb) { gb.hidden = gm === 0; gb.textContent = gm; }
  const rm = counts('reg', 'reg');
  const REGORD = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte', 'Exterior', 'Não informado'];
  $('#f-reg').innerHTML = REGORD.filter(x => rm.has(x) || F.reg.has(x)).map(x =>
    `<button class="chip" data-set="reg" data-v="${esc(x)}" aria-pressed="${F.reg.has(x)}">${x} <span style="opacity:.6;font-family:var(--mono);font-size:10px">${fmt(rm.get(x) || 0)}</span></button>`).join('');
  const tm = counts('tr', 'tr');
  $('#tiers').innerHTML = ['A', 'B', 'C'].map(t =>
    `<button class="tierbtn" data-t="${t}" aria-pressed="${F.tr.has(t)}"><b>${t}</b><span>${fmt(tm.get(t) || 0)}</span></button>`).join('');
  $('#flags').innerHTML = FLAGS.map(f =>
    `<label class="opt"><input type="checkbox" data-flag="${f.k}"${F.flags.has(f.k) ? ' checked' : ''}><span class="opt__l">${f.l}</span></label>`).join('');
}
function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

/* ───────────────── topo: KPIs, composição, gráficos ───────────────── */
function renderTop() {
  const v = VIEW, n = v.length;
  const empresas = new Set(v.map(r => r.c.toLowerCase())).size;
  const ti = v.filter(r => r.ti).length;
  const corp = v.filter(r => r.corp).length;
  const clevel = v.filter(r => r.sen === 'C-Level').length;
  const avg = n ? Math.round(v.reduce((s, r) => s + r.sc, 0) / n) : 0;
  const revs = v.map(r => r.rev).filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
  const kpis = [
    ['Contatos no filtro', fmt(n), n === ROWS.length ? 'base completa' : (100 * n / ROWS.length).toFixed(1) + '% da base'],
    ['Empresas distintas', fmt(empresas), n ? (n / (empresas || 1)).toFixed(1) + ' contatos por empresa' : '—'],
    ['Decisores C-level', fmt(clevel), n ? Math.round(100 * clevel / n) + '% do segmento' : '—'],
    ['Decisores de TI', fmt(ti), n ? Math.round(100 * ti / n) + '% do segmento' : '—'],
    ['E-mail corporativo', n ? Math.round(100 * corp / n) + '%' : '—', fmt(n - corp) + ' em domínio pessoal'],
  ];
  if (HAS_REV) kpis.push(['Faturamento mediano (USD)', revs.length ? fmtRev(revs[Math.floor(revs.length / 2)]) : '—',
    revs.length ? `${fmt(revs.length)} com dado · maior ${fmtRev(revs[revs.length - 1])}` : 'sem dado no recorte']);
  $('#kpis').innerHTML = kpis.map(k => `<div class="kpi"><div class="kpi__l">${k[0]}</div><div class="kpi__v">${k[1]}</div><div class="kpi__d">${k[2]}</div></div>`).join('');
  $('#avg').textContent = avg;

  const t = { A: 0, B: 0, C: 0 }; v.forEach(r => t[r.tr]++);
  const bar = $('#bar').children;
  ['A', 'B', 'C'].forEach((k, i) => {
    const p = n ? 100 * t[k] / n : 0;
    bar[i].style.width = p + '%';
    bar[i].textContent = p >= 7 ? Math.round(p) + '%' : '';
  });
  const LBL = { A: 'Prioridade A — atacar agora', B: 'Prioridade B — nutrir', C: 'Prioridade C — baixa aderência' };
  const CLR = { A: 'var(--a)', B: 'var(--b)', C: 'var(--c)' };
  $('#leg').innerHTML = ['A', 'B', 'C'].map(k =>
    `<span class="leg"><i style="background:${CLR[k]}"></i>${LBL[k]} <b>${fmt(t[k])}</b></span>`).join('');

  chart('ch-f', 'f'); chart('ch-ind', 'ind', PROF_IND); chart('ch-pt', 'pt');
  const geoRows = apply('est');
  chart('ch-uf', 'est', 8, geoRows);
  renderMap(geoRows);
  if (HAS_REV) chart('ch-rev', 'revb');
  $('#sub').textContent = `${fmt(ROWS.length)} executivos · ${fmt(new Set(ROWS.map(r => r.c.toLowerCase())).size)} empresas · pontuados para serviços gerenciados de TI`;
  renderStamp();
  $('#railN').textContent = fmt(n);
  $('#tblN').textContent = fmt(n);
}
let PROF_IND = 8;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-prof]');
  if (!b) return;
  PROF_IND = +b.dataset.prof;
  document.querySelectorAll('[data-prof]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  render();
});
const ORDER_PT = ['Micro (< 50)', 'Pequena (50–199)', 'Média (200–999)', 'Grande (1.000–4.999)', 'Corporação (5.000–19.999)', 'Mega corporação (20.000+)', 'Não informado'];
function chart(id, key, top, rows) {
  const m = new Map();
  (rows || VIEW).forEach(r => { const v = r[key] || '—'; m.set(v, (m.get(v) || 0) + 1); });
  let list = [...m.entries()];
  if (key === 'pt') list.sort((a, b) => ORDER_PT.indexOf(a[0]) - ORDER_PT.indexOf(b[0]));
  else if (key === 'revb') list.sort((a, b) => FAIXA_ORD.indexOf(a[0]) - FAIXA_ORD.indexOf(b[0]));
  else list.sort((a, b) => b[1] - a[1]);
  const total = list.length;
  if (top) list = list.slice(0, top);
  const max = Math.max(1, ...list.map(x => x[1]));
  const sobra = top ? Math.max(0, total - list.length) : 0;
  document.getElementById(id).innerHTML = (list.length ? list.map(([v, n]) =>
    `<button class="b" data-set="${key}" data-v="${esc(v)}" aria-pressed="${F[key] && F[key].has(v)}"><span class="b__l" title="${esc(v)}">${esc(v)}</span><span class="b__t"><i class="b__f" style="width:${100 * n / max}%"></i></span><span class="b__n">${fmt(n)}</span></button>`
  ).join('') : '<div style="font-size:12px;color:var(--muted);padding:6px 4px">Sem dados no filtro atual.</div>') +
    (sobra ? `<div class="chmais">+ ${fmt(sobra)} ${sobra === 1 ? 'setor fora da lista' : 'não listados'}</div>` : '');
}

/* ───────────────── tabela ───────────────── */
function renderTable() {
  const total = VIEW.length, pages = Math.max(1, Math.ceil(total / pageSize));
  if (page > pages) page = pages;
  const slice = VIEW.slice((page - 1) * pageSize, page * pageSize);
  const tb = $('#tbody');
  tb.innerHTML = slice.map(r => `
    <tr data-i="${r.i}" class="${SEL.has(r.i) ? 'sel' : ''}">
      <td><input type="checkbox" class="cbx" data-pick="${r.i}"${SEL.has(r.i) ? ' checked' : ''} aria-label="Selecionar ${esc(r.n)}"></td>
      <td><div class="scorecell"><span class="tier tier--${r.tr}">${r.tr}</span><span class="sbar"><i style="width:${r.sc}%"></i></span><span class="scoren">${r.sc}</span></div></td>
      <td><div class="nm">${esc(r.n)}</div><div class="sub" title="${esc(r.t)}">${esc(r.t)}</div><div style="margin-top:4px"><span class="tag">${esc(r.f)}</span>${r.ti ? ' <span class="tag tag--ti">TI</span>' : ''}</div></td>
      <td><div class="co">${esc(r.c)}</div><div class="sub">${esc(r.pt)}</div></td>
      <td style="font-size:12px">${esc(r.ind)}</td>
      <td class="num">${r.em === null ? '—' : fmt(r.em)}</td>
      <td class="num" data-col="rev">${fmtRev(r.rev)}</td>
      <td style="font-size:12px">${esc(r.loc || '—')}</td>
      <td style="font-size:12px"><div>${esc(r.e || '—')}</div>${!r.corp && r.e ? '<div class="sub" style="color:#B07800">domínio pessoal</div>' : ''}${r.dup ? '<div class="sub" style="color:#B07800">e-mail duplicado</div>' : ''}</td>
      <td>${r.li ? `<a class="linkico" href="${esc(r.li)}" target="_blank" rel="noopener" title="LinkedIn" onclick="event.stopPropagation()"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 11-.01 5.001A2.5 2.5 0 014.98 3.5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.3 8.75 21 11 21 14.1V21h-4v-6.1c0-1.46-.03-3.34-2.03-3.34-2.03 0-2.34 1.59-2.34 3.23V21H9z"/></svg></a>` : ''}
          ${r.e ? `<button class="linkico" data-mail="${esc(r.e)}" title="Escrever para ${esc(r.e)}" style="margin-left:6px;vertical-align:middle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></button>` : ''}</td>
    </tr>`).join('');

  $('#emptyBox').innerHTML = total ? '' :
    `<div class="empty"><h3>Nenhum contato atende a esses filtros</h3><p>Afrouxe um critério — normalmente é a faixa de funcionários ou a combinação de setor com cidade.</p><button class="btn" onclick="document.getElementById('reset').click()">Limpar filtros</button></div>`;

  const pg = [];
  pg.push(`<button class="pg" data-pg="1" ${page === 1 ? 'disabled' : ''}>«</button>`);
  pg.push(`<button class="pg" data-pg="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`);
  const from = Math.max(1, Math.min(page - 2, pages - 4)), to = Math.min(pages, from + 4);
  for (let i = from; i <= to; i++) pg.push(`<button class="pg" data-pg="${i}" aria-current="${i === page}">${i}</button>`);
  pg.push(`<button class="pg" data-pg="${page + 1}" ${page === pages ? 'disabled' : ''}>›</button>`);
  pg.push(`<button class="pg" data-pg="${pages}" ${page === pages ? 'disabled' : ''}>»</button>`);
  pg.push(`<span class="pgi">${total ? fmt((page - 1) * pageSize + 1) + '–' + fmt(Math.min(page * pageSize, total)) : '0'} de ${fmt(total)}</span>`);
  $('#pager').innerHTML = pg.join('');

  $('#selN').textContent = fmt(SEL.size);
  $('#selinfo').hidden = SEL.size === 0;
  const allOn = slice.length && slice.every(r => SEL.has(r.i));
  $('#headcbx').checked = !!allOn;
  document.querySelectorAll('th.s').forEach(th => {
    if (th.dataset.k === sortK) { th.dataset.dir = sortDir; th.querySelector('.ar').textContent = sortDir === 'asc' ? '▴' : '▾'; }
    else th.removeAttribute('data-dir');
  });
}

function render() { checkRev(); VIEW = sorted(apply()); renderPresets(); renderFacets(); renderTop(); renderTable(); renderExc(); renderSource(); }

/* ───────────────── eventos ───────────────── */
let qt;
$('#q').addEventListener('input', e => {
  clearTimeout(qt);
  qt = setTimeout(() => { const v = norm(e.target.value.trim()); F.q = v ? v.split(/\s+/) : ''; page = 1; render(); }, 160);
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-grp]');
  if (g) { const p = g.parentElement; p.dataset.open = p.dataset.open === '1' ? '0' : '1'; return; }
  const t = e.target.closest('.tierbtn');
  if (t) { toggle(F.tr, t.dataset.t); page = 1; render(); return; }
  const more = e.target.closest('[data-more]');
  if (more) { expanded[more.dataset.more] = !expanded[more.dataset.more]; renderFacets(); return; }
  const ex = e.target.closest('[data-ex]');
  if (ex) {
    e.preventDefault(); e.stopPropagation();
    const set = F.exc[ex.dataset.ex], v = ex.dataset.v;
    if (set.has(v)) set.delete(v); else { set.add(v); F[ex.dataset.ex].delete(v); }
    page = 1; render(); return;
  }
  const unex = e.target.closest('[data-unex]');
  if (unex) { F.exc[unex.dataset.unex].delete(unex.dataset.v); page = 1; render(); return; }
  const unexq = e.target.closest('[data-unexq]');
  if (unexq) {
    F.exq = F.exq.filter(w => w !== unexq.dataset.unexq);
    F.exqn = F.exq.map(norm);
    $('#exq').value = F.exq.join(', ');
    page = 1; render(); return;
  }
  const bulk = e.target.closest('[data-bulk]');
  if (bulk) {
    const set = F[bulk.dataset.bulk];
    if (bulk.dataset.on === '0') set.clear();
    else document.querySelectorAll(`#f-${bulk.dataset.bulk} input[data-set]`).forEach(i => set.add(i.value));
    page = 1; render(); return;
  }
  const b = e.target.closest('.b[data-set], .chip[data-set]');
  if (b) {
    const k = b.dataset.set, v = b.dataset.v;
    if (e.shiftKey && F.exc[k]) { if (F.exc[k].has(v)) F.exc[k].delete(v); else { F.exc[k].add(v); F[k].delete(v); } }
    else toggle(F[k], v);
    page = 1; render(); return;
  }
  const ps = e.target.closest('[data-preset]');
  if (ps) { applyPreset(+ps.dataset.preset, ps); return; }
  const pgb = e.target.closest('[data-pg]');
  if (pgb && !pgb.disabled) { page = +pgb.dataset.pg; renderTable(); window.scrollTo({ top: $('.tbl').offsetTop - 80, behavior: 'smooth' }); return; }
  const th = e.target.closest('th.s');
  if (th) { if (sortK === th.dataset.k) sortDir = sortDir === 'asc' ? 'desc' : 'asc'; else { sortK = th.dataset.k; sortDir = (sortK === 'sc' || sortK === 'em' || sortK === 'rev') ? 'desc' : 'asc'; } render(); return; }
  const mb = e.target.closest('[data-mail]');
  if (mb) { e.stopPropagation(); openMail(mb, mb.dataset.mail); return; }
  if (!e.target.closest('#pop')) closePop();
  const tr = e.target.closest('tbody tr');
  if (tr && !e.target.closest('input,a,button')) openDrawer(+tr.dataset.i);
});

/* ───────────────── menu de e-mail ─────────────────
   mailto: só abre se houver cliente padrão instalado; num navegador
   com webmail ele não faz nada. Por isso o envelope abre um menu. */
const ICO = {
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
  out: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>'
};
function openMail(anchor, addr) {
  const pop = $('#pop');
  const enc = encodeURIComponent(addr);
  pop.innerHTML = `<div class="pop__h" title="${esc(addr)}">${esc(addr)}</div>
    <button class="pop__i" data-act="copy">${ICO.copy} Copiar endereço</button>
    <a class="pop__i" href="https://outlook.office.com/mail/deeplink/compose?to=${enc}" target="_blank" rel="noopener">${ICO.out} Escrever no Outlook Web</a>`;
  pop.dataset.addr = addr;
  pop.classList.add('on');
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - w - 12);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 6);
  pop.style.left = Math.max(10, left) + 'px';
  pop.style.top = top + 'px';
}
function closePop() { $('#pop').classList.remove('on'); }
$('#pop').addEventListener('click', e => {
  const it = e.target.closest('.pop__i');
  if (!it) return;
  if (it.dataset.act === 'copy') copy($('#pop').dataset.addr, 'E-mail copiado');
  closePop();
});
window.addEventListener('scroll', closePop, true);
window.addEventListener('resize', closePop);
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.set) { toggle(F[el.dataset.set], el.value); page = 1; render(); }
  else if (el.dataset.flag) { toggle(F.flags, el.dataset.flag); page = 1; render(); }
  else if (el.dataset.pick) { const i = +el.dataset.pick; el.checked ? SEL.add(i) : SEL.delete(i); renderTable(); }
});
function toggle(set, v) { set.has(v) ? set.delete(v) : set.add(v); }
const EX_RAPIDO = ['assistente', 'estagiário', 'trainee', 'aposentado', 'consultor'];
$('#exquick').innerHTML = EX_RAPIDO.map(w => `<button class="chip" data-exq="${w}">− ${w}</button>`).join('');
document.addEventListener('click', e => {
  const c = e.target.closest('[data-exq]');
  if (!c) return;
  const w = c.dataset.exq;
  if (F.exq.includes(w)) F.exq = F.exq.filter(x => x !== w); else F.exq.push(w);
  F.exqn = F.exq.map(norm);
  $('#exq').value = F.exq.join(', ');
  page = 1; render();
});
let ext;
$('#exq').addEventListener('input', e => {
  clearTimeout(ext);
  ext = setTimeout(() => {
    F.exq = e.target.value.split(',').map(x => x.trim()).filter(Boolean);
    F.exqn = F.exq.map(norm);
    page = 1; render();
  }, 220);
});
let cst;
$('#cisearch').addEventListener('input', () => { clearTimeout(cst); cst = setTimeout(renderFacets, 130); });
['rmin', 'rmax'].forEach(id => $('#' + id).addEventListener('change', e => {
  const raw = e.target.value.trim();
  const v = raw === '' ? null : ING.revOf(raw);
  F[id] = v;
  if (raw && v !== null) e.target.value = fmtRev(v);
  page = 1; render();
}));
$('#emin').addEventListener('change', e => { F.emin = e.target.value === '' ? null : +e.target.value; page = 1; render(); });
$('#emax').addEventListener('change', e => { F.emax = e.target.value === '' ? null : +e.target.value; page = 1; render(); });
$('#pageSize').addEventListener('change', e => { pageSize = +e.target.value; page = 1; renderTable(); });
$('#headcbx').addEventListener('change', e => {
  VIEW.slice((page - 1) * pageSize, page * pageSize).forEach(r => e.target.checked ? SEL.add(r.i) : SEL.delete(r.i));
  renderTable();
});
$('#selall').addEventListener('click', () => { VIEW.forEach(r => SEL.add(r.i)); renderTable(); });
$('#selnone').addEventListener('click', () => { SEL.clear(); renderTable(); });
function resetAll() {
  PRESET_ON = -1;
  F = BLANK(); $('#q').value = ''; $('#emin').value = ''; $('#emax').value = ''; $('#cisearch').value = ''; $('#rmin').value = ''; $('#rmax').value = ''; $('#exq').value = ''; if ($('#mapbusca')) $('#mapbusca').value = '';
  document.querySelectorAll('[data-preset]').forEach(x => x.setAttribute('aria-pressed', 'false'));
  SEL.clear();
  page = 1; render();
}
function filtrosAtivos() {
  if (F.q && F.q.length) return true;
  if (F.emin !== null || F.emax !== null || F.rmin !== null || F.rmax !== null) return true;
  if (F.exq.length) return true;
  for (const k of ['tr', 'f', 'ind', 'pt', 'revb', 'reg', 'est', 'ci', 'dp', 'flags']) if (F[k].size) return true;
  for (const k in F.exc) if (F.exc[k].size) return true;
  return false;
}
$('#reset').addEventListener('click', resetAll);
let gbt;
$('#mapbusca').addEventListener('input', () => { clearTimeout(gbt); gbt = setTimeout(renderGeoSug, 140); });
$('#mapbusca').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const b = $('#mapsug button[data-geo]'); if (b) b.click(); e.preventDefault(); }
  if (e.key === 'Escape') { $('#mapbusca').value = ''; renderGeoSug(); }
});
document.addEventListener('click', e => {
  const sug = e.target.closest('[data-geo]');
  if (sug) {
    const k = sug.dataset.geo, v = sug.dataset.v;
    toggle(F[k], v); F.exc[k].delete(v);
    $('#mapbusca').value = ''; renderGeoSug();
    page = 1; render();
    return;
  }
  const x = e.target.closest('[data-geox]');
  if (x) { F[x.dataset.geox].delete(x.dataset.v); page = 1; render(); return; }
  if (!e.target.closest('.geobusca, .geosug')) { const c = $('#mapsug'); if (c) { c.hidden = true; } }
});
$('#verTudo').addEventListener('click', () => { resetAll(); toast('Exibindo a base completa'); });
$('#railtoggle').addEventListener('click', () => $('#rail').classList.toggle('on'));
$('#scrim').addEventListener('click', closeDrawer);
$('#drx').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePop(); closeDrawer(); $('#rail').classList.remove('on'); } });

function renderPresets() {
  $('#niveis').innerHTML = NIVEIS.map(nv =>
    `<button data-nivel="${nv.n}" aria-pressed="${NIVEL === nv.n}" title="${esc(nv.t)} — ${esc(nv.d)}"><b>Nível ${nv.n}</b><span>${PRESETS.filter(p => p.n === nv.n).length}</span></button>`).join('');
  const nv = NIVEIS.find(x => x.n === NIVEL);
  $('#niveldesc').textContent = `${nv.t} — ${nv.d}.`;
  const lista = PRESETS.map((p, i) => [p, i]).filter(([p]) => p.n === NIVEL);
  const chips = lista.map(([p, i]) => {
    const n = contaPreset(p);
    if (!n) return '';
    return `<button class="chip" data-preset="${i}" aria-pressed="${PRESET_ON === i}">${esc(p.l)}<span class="chip__n">${fmt(n)}</span></button>`;
  }).filter(Boolean);
  $('#presets').innerHTML = chips.length ? chips.join('')
    : '<span style="font-size:11.5px;color:#7B93A8">Nenhum segmento deste nível tem contatos na base atual.</span>';
}
let PRESET_ON = -1;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-nivel]');
  if (!b) return;
  NIVEL = +b.dataset.nivel;
  renderPresets();
});
function applyPreset(i, el) {
  const on = el.getAttribute('aria-pressed') === 'true';
  F = BLANK(); $('#q').value = ''; $('#emin').value = ''; $('#emax').value = ''; $('#cisearch').value = ''; $('#rmin').value = ''; $('#rmax').value = ''; $('#exq').value = ''; if ($('#mapbusca')) $('#mapbusca').value = '';
  PRESET_ON = on ? -1 : i;
  if (!on) {
    const s = criterios(PRESETS[i]);
    for (const k in s) (s[k] || []).forEach(v => F[k] && F[k].add(v));
    ['ind', 'pt'].forEach(k => { if (s[k]) { const g = document.querySelector(`[data-n="${k}"]`); if (g) g.closest('.grp').dataset.open = '1'; } });
    if (s.est || s.ci || s.reg) $('#geo').dataset.open = '1';
  }
  page = 1; render();
}

/* ───────────────── ficha do contato ───────────────── */
const PCL = ['Cargo / poder de decisão', 'Porte da empresa', 'Aderência do setor', 'Localização', 'Contactabilidade', 'Bônus área de TI'];
const PCM = [30, 35, 20, 10, 5, 4];
function openDrawer(i) {
  const r = ROWS[i];
  $('#drN').textContent = r.n;
  $('#drT').textContent = r.t;
  $('#drB').innerHTML = `
    <dl style="margin:0">
      ${fld('Empresa', esc(r.c))}
      ${fld('Setor', esc(r.ind))}
      ${fld('Porte', esc(r.pt) + (r.em ? ` · ${fmt(r.em)} funcionários` : ''))}
      ${HAS_REV ? fld('Faturamento (USD)', (r.rev === null || r.rev === undefined) ? '—' : `${fmtRev(r.rev)} <span class="tag">${esc(r.revb)}</span>`) : ''}
      ${fld('Local', esc(r.loc || '—'))}
      ${fld('E-mail', r.e ? `<button data-mail="${esc(r.e)}" style="color:var(--navy);text-decoration:underline;font-size:13px;text-align:left">${esc(r.e)}</button>${r.corp ? '' : ' <span class="tag">domínio pessoal</span>'}` : '—')}
      ${fld('LinkedIn', r.li ? `<a href="${esc(r.li)}" target="_blank" rel="noopener" style="color:var(--navy)">abrir perfil</a>` : '—')}
      ${fld('Família', esc(r.f) + ' · ' + esc(r.sen))}
      ${fld('Departamentos', r.dp.length ? r.dp.map(d => `<span class="tag" style="margin:0 3px 3px 0">${esc(d)}</span>`).join('') : '—')}
    </dl>
    <div class="dr__sec">Como o score ${r.sc}/100 foi formado</div>
    <div class="pts">${r.pc.map((v, k) => `<div class="pt"><span>${PCL[k]}</span><span class="pt__t"><i class="pt__f" style="width:${100 * v / PCM[k]}%"></i></span><span class="pt__n">${v}/${PCM[k]}</span></div>`).join('')}</div>
    <p style="font-size:11.5px;color:var(--muted);margin-top:12px;line-height:1.6">O score pondera o que importa para uma venda de serviços gerenciados de TI: quem decide, quanto a operação pesa, se o setor tem dependência crítica de infraestrutura e o quão perto o cliente está da nossa base.</p>`;
  $('#drA').innerHTML = `
    <button class="btn btn--primary" data-dossie="${r.i}">Montar abordagem</button>
    ${r.e ? `<button class="btn" data-mail="${esc(r.e)}">Escrever e-mail</button>` : ''}
    ${r.li ? `<a class="btn" href="${esc(r.li)}" target="_blank" rel="noopener">Abrir LinkedIn</a>` : ''}`;
  $('#drawer').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('on');
}
function fld(k, v) { return `<div class="fld"><dt>${k}</dt><dd>${v}</dd></div>`; }
function closeDrawer() { $('#drawer').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('on'); }

/* ───────────────── utilidades ───────────────── */
let tt;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2400); }
function copy(txt, msg) {
  const done = () => toast(msg || 'Copiado');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done).catch(fallback);
  else fallback();
  function fallback() {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Não foi possível copiar neste navegador'); }
    ta.remove();
  }
}
window.copy = copy;
function target() { return SEL.size ? VIEW.filter(r => SEL.has(r.i)) : VIEW; }
function stamp() { const d = new Date(); return d.toISOString().slice(0, 10).replace(/-/g, ''); }
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}

$('#copyMails').addEventListener('click', () => {
  const list = [...new Set(target().map(r => r.e).filter(Boolean))];
  if (!list.length) return toast('Nenhum e-mail no recorte atual');
  copy(list.join('; '), `${fmt(list.length)} e-mails copiados`);
});

function cols() { return HAS_REV ? COLS : COLS.filter(c => !c[4]); }
const COLS = [
  ['Nome', 28, 's', r => r.n], ['Cargo', 34, 's', r => r.t], ['Família do cargo', 20, 's', r => r.f],
  ['Senioridade', 14, 's', r => r.sen], ['Empresa', 26, 's', r => r.c], ['Setor', 24, 's', r => r.ind],
  ['Funcionários', 13, 'n', r => r.em], ['Porte', 22, 's', r => r.pt],
  ['Faturamento anual (USD)', 20, 'n', r => (r.rev === null || r.rev === undefined) ? '' : r.rev, true],
  ['Faixa de faturamento (USD)', 20, 's', r => r.revb, true],
  ['E-mail', 30, 's', r => r.e], ['Domínio', 22, 's', r => r.dom],
  ['E-mail corporativo', 16, 's', r => r.corp ? 'Sim' : 'Não'],
  ['Município', 20, 's', r => r.ci], ['Estado', 20, 's', r => r.est], ['UF', 7, 's', r => r.uf], ['Região', 15, 's', r => r.reg],
  ['Departamentos', 34, 's', r => r.dp.join(', ')],
  ['Decisor de TI', 13, 's', r => r.ti ? 'Sim' : 'Não'],
  ['Score ICP', 10, 'n', r => r.sc], ['Prioridade', 11, 's', r => r.tr],
  ['LinkedIn', 42, 's', r => r.li],
];
function summaryRows(rows) {
  const out = [];
  const grp = (label, key) => {
    const m = new Map();
    rows.forEach(r => { const v = r[key] || '—'; if (!m.has(v)) m.set(v, { n: 0, s: 0, a: 0 }); const o = m.get(v); o.n++; o.s += r.sc; if (r.tr === 'A') o.a++; });
    [...m.entries()].sort((x, y) => y[1].n - x[1].n).forEach(([v, o]) =>
      out.push([label, v, o.n, o.a, Math.round(o.s / o.n)]));
  };
  grp('Prioridade ICP', 'tr'); grp('Família do cargo', 'f'); grp('Porte', 'pt');
  if (HAS_REV) grp('Faixa de faturamento (USD)', 'revb'); grp('Setor', 'ind'); grp('Região', 'reg'); grp('Estado', 'est'); grp('Município', 'ci');
  return out;
}
function companyRows(rows) {
  const m = new Map();
  rows.forEach(r => {
    const k = r.c; if (!m.has(k)) m.set(k, { c: r.c, ind: r.ind, pt: r.pt, em: r.em, rev: r.rev, uf: r.uf, n: 0, ti: 0, best: 0 });
    const o = m.get(k); o.n++; if (r.ti) o.ti++; o.best = Math.max(o.best, r.sc);
  });
  return [...m.values()].sort((a, b) => b.best - a.best || b.n - a.n)
    .map(o => HAS_REV
      ? [o.c, o.ind, o.pt, o.em, (o.rev === null || o.rev === undefined) ? '' : o.rev, o.uf, o.n, o.ti, o.best]
      : [o.c, o.ind, o.pt, o.em, o.uf, o.n, o.ti, o.best]);
}

$('#expXls').addEventListener('click', () => {
  const rows = target();
  if (!rows.length) return toast('Nenhum contato para exportar');
  try {
    const blob = XL.build([
      { name: 'Contatos', cols: cols().map(c => ({ h: c[0], w: c[1], t: c[2] })), rows: rows.map(r => cols().map(c => c[3](r))) },
      { name: 'Resumo por segmento', cols: [{ h: 'Dimensão', w: 20, t: 's' }, { h: 'Valor', w: 32, t: 's' }, { h: 'Contatos', w: 12, t: 'n' }, { h: 'Prioridade A', w: 14, t: 'n' }, { h: 'Score médio', w: 13, t: 'n' }], rows: summaryRows(rows) },
      { name: 'Empresas', cols: [{ h: 'Empresa', w: 30, t: 's' }, { h: 'Setor', w: 24, t: 's' }, { h: 'Porte', w: 22, t: 's' }, { h: 'Funcionários', w: 13, t: 'n' }, ...(HAS_REV ? [{ h: 'Faturamento anual (USD)', w: 20, t: 'n' }] : []), { h: 'Estado', w: 8, t: 's' }, { h: 'Contatos', w: 11, t: 'n' }, { h: 'Contatos de TI', w: 14, t: 'n' }, { h: 'Melhor score', w: 13, t: 'n' }], rows: companyRows(rows) },
    ]);
    download(blob, `OnSet_Decisores_${stamp()}.xlsx`);
    toast(`${fmt(rows.length)} contatos exportados para Excel`);
  } catch (err) { console.error(err); toast('A exportação falhou — tente o CSV'); }
});
$('#expCsv').addEventListener('click', () => {
  const rows = target();
  if (!rows.length) return toast('Nenhum contato para exportar');
  const q = v => { v = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = [cols().map(c => c[0]).join(';'), ...rows.map(r => cols().map(c => q(c[3](r))).join(';'))].join('\r\n');
  download(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), `OnSet_Decisores_${stamp()}.csv`);
  toast(`${fmt(rows.length)} contatos exportados em CSV`);
});


/* ═══════════════ ATUALIZAÇÃO DA BASE ═══════════════ */
const LBL = { first: 'Nome', last: 'Sobrenome', full: 'Nome completo', title: 'Cargo', company: 'Empresa', email: 'E-mail', dept: 'Departamentos', emp: 'Funcionários', ind: 'Setor', li: 'LinkedIn', city: 'Município', state: 'Estado', rev: 'Faturamento anual (USD)' };
$('#aliaslist').innerHTML = Object.keys(LBL).map(k =>
  `<div class="aliasrow"><b>${LBL[k]}</b><span>${ING.ALIAS[k].join(' · ')}</span></div>`).join('');

let MODO = 'rep';
document.addEventListener('click', e => {
  const b = e.target.closest('[data-modo]');
  if (!b) return;
  MODO = b.dataset.modo;
  document.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('#drop').querySelector('.drop__t').textContent = MODO === 'add'
    ? 'Arraste o arquivo a acrescentar ou clique para escolher'
    : 'Arraste o arquivo aqui ou clique para escolher';
});

/* ───── identidade do contato ─────
   Duplicado = mesma pessoa NA MESMA empresa. A mesma pessoa em empresas
   diferentes permanece como dois registros. */
const SUFIXOS = /\b(ltda|lda|s\s?a|sa|me|epp|eireli|mei|inc|llc|ltd|corp|corporation|co|cia|company|group|grupo|holding|participacoes|industria|comercio|e|do|da|de|dos|das)\b/g;
function normEmp(c) {
  return norm(c).replace(/[^a-z0-9 ]/g, ' ').replace(SUFIXOS, ' ').replace(/\s+/g, ' ').trim();
}
function chavesDe(r) {
  const emp = normEmp(r.c), e = (r.e || '').trim().toLowerCase(), nome = norm(r.n);
  const ks = [];
  if (nome) ks.push('nc:' + nome + '|' + emp);
  if (e) ks.push('ec:' + e + '|' + emp);
  if (!ks.length && e) ks.push('e:' + e);
  return ks;
}
function completude(r) {
  return (r.e ? 3 : 0) + (r.li ? 2 : 0) + (r.em !== null && r.em !== undefined ? 1 : 0) +
    (r.rev !== null && r.rev !== undefined ? 1 : 0) + (r.dp && r.dp.length ? 1 : 0) +
    (r.t ? 1 : 0) + (r.ci ? 1 : 0) + (r.uf ? 1 : 0);
}
function fundir(base, entrando) {
  const out = base.slice(), idx = new Map();
  out.forEach((r, i) => chavesDe(r).forEach(k => idx.set(k, i)));
  let novos = 0, atualizados = 0, ignorados = 0;
  entrando.forEach(r => {
    const ks = chavesDe(r);
    let achou = -1;
    for (const k of ks) if (idx.has(k)) { achou = idx.get(k); break; }
    if (achou < 0) {
      out.push(r); ks.forEach(k => idx.set(k, out.length - 1)); novos++;
    } else if (completude(r) > completude(out[achou])) {
      out[achou] = r; ks.forEach(k => idx.set(k, achou)); atualizados++;
    } else {
      ks.forEach(k => { if (!idx.has(k)) idx.set(k, achou); });
      ignorados++;
    }
  });
  return { rows: out, novos, atualizados, ignorados };
}
function marcarRepetidos(rows) {
  const c = new Map();
  rows.forEach(r => { const e = (r.e || '').toLowerCase(); if (e) c.set(e, (c.get(e) || 0) + 1); });
  rows.forEach(r => { const e = (r.e || '').toLowerCase(); r.dup = !!e && c.get(e) > 1; });
  return rows;
}

function openUpl() { $('#upl').classList.add('on'); $('#upl').setAttribute('aria-hidden', 'false'); }
function closeUpl() { $('#upl').classList.remove('on'); $('#upl').setAttribute('aria-hidden', 'true'); }
$('#btnUp').addEventListener('click', openUpl);
$('#uplx').addEventListener('click', closeUpl);
$('#upl').addEventListener('click', e => { if (e.target.id === 'upl') closeUpl(); });
$('#file').addEventListener('change', e => { if (e.target.files[0]) ingest(e.target.files[0]); e.target.value = ''; });
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) ingest(f); });

function msg(cls, html) { $('#uplmsg').innerHTML = `<div class="msg msg--${cls}">${html}</div>`; }

async function ingest(file) {
  if (DB.busy) return;
  const description = $('#baseDescription').value.trim();
  if (description.length < 5) {
    $('#baseDescription').focus();
    return msg('err', 'Descreva do que se trata esta base antes de escolher a planilha (mínimo 5 caracteres).');
  }
  DB.busy = true; $('#file').disabled = true;
  msg('busy', `Lendo <b>${esc(file.name)}</b>…`);
  try {
    const raw = await ING.readFile(file);
    if (!raw.length) return msg('err', 'O arquivo não tem linhas de dados abaixo do cabeçalho.');
    const head = Object.keys(raw[0]);
    const map = ING.mapCols(head);
    const faltando = ['title', 'company'].filter(k => !map[k]);
    if (!map.full && !map.first) faltando.unshift('name');
    if (faltando.length) {
      return msg('err', `Não encontrei as colunas obrigatórias: <b>${faltando.map(k => LBL[k] || 'Nome').join(', ')}</b>.<br>Cabeçalhos lidos: <code>${head.slice(0, 14).map(esc).join('</code> <code>')}</code>${head.length > 14 ? ' …' : ''}<br>Confira a lista de nomes aceitos abaixo e renomeie a coluna na planilha.`);
    }
    const rows = ING.build(raw, map);
    if (!rows.length) return msg('err', 'Nenhum contato válido foi encontrado no arquivo.');

    if (DB.connected()) {
      msg('busy', 'Salvando a nova base no banco…');
      const item = await DB.save(file, rows, description);
      const date = new Date(item.imported_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      msg('ok', `<b>${esc(item.description)}</b> salva com ${fmt(item.record_count)} contatos em ${date} (Brasília).<br>A base exibida no painel continua a mesma. `);
      const button = document.createElement('button'); button.className = 'btn btn--primary'; button.textContent = 'Usar esta base';
      button.onclick = () => DB.activate(item.id); $('#uplmsg').append(button);
      return;
    }

    const antes = MODO === 'add' ? ROWS.length : 0;
    const fus = fundir(MODO === 'add' ? ROWS : [], rows);
    const finais = marcarRepetidos(fus.rows);
    finais.forEach((r, i) => r.i = i);
    ROWS = indexRows(finais);

    const arquivos = (SOURCE && MODO === 'add' && SOURCE.files ? SOURCE.files : []).concat([file.name]);
    SOURCE = { name: description, description, local: true,
               files: arquivos, when: new Date(), n: ROWS.length };
    SEL.clear(); F = BLANK(); page = 1;
    $('#q').value = ''; $('#emin').value = ''; $('#emax').value = ''; $('#cisearch').value = ''; $('#rmin').value = ''; $('#rmax').value = ''; $('#exq').value = ''; if ($('#mapbusca')) $('#mapbusca').value = '';
    document.querySelectorAll('[data-preset]').forEach(x => x.setAttribute('aria-pressed', 'false'));
    render();

    const ausentes = Object.keys(LBL).filter(k => !map[k] && !(k === 'full' && map.first) && !(k === 'first' && map.full) && k !== 'last');

    // diagnóstico do mapa: a coluna de estado foi lida? os valores foram reconhecidos?
    const lidos = rows;
    const comUF = lidos.filter(r => r.uf).length;
    let geo = '';
    if (!lidos.length) {
      geo = '';            // nada novo entrou: não há o que diagnosticar
    } else if (!map.state) {
      geo = `<br><b>Mapa do Brasil vazio:</b> nenhuma coluna de estado foi reconhecida. ` +
        `Renomeie a coluna para <code>State</code> ou <code>Estado</code>. Cabeçalhos lidos: <code>${head.slice(0, 12).map(esc).join('</code> <code>')}</code>${head.length > 12 ? ' …' : ''}`;
    } else {
      const naoLidos = [...new Set(raw.map(r => (r[map.state] || '').trim())
        .filter(v => v && !ING.ufOf(v)))].slice(0, 4);
      if (!comUF) {
        geo = `<br><b>Mapa do Brasil vazio:</b> a coluna <code>${esc(map.state)}</code> foi lida, mas nenhum valor corresponde a um estado brasileiro.` +
          (naoLidos.length ? ` Exemplos encontrados: ${naoLidos.map(v => '<code>' + esc(v) + '</code>').join(', ')}.` : '');
      } else {
        geo = `<br>Estado identificado em <b>${fmt(comUF)}</b> de ${fmt(rows.length)} contatos lidos, pela coluna <code>${esc(map.state)}</code>.` +
          (naoLidos.length ? ` Não reconhecidos: ${naoLidos.map(v => '<code>' + esc(v) + '</code>').join(', ')}.` : '');
      }
    }
    const dups = fus.atualizados + fus.ignorados;
    const detalhe = dups
      ? ` · ${fmt(dups)} duplicado${dups > 1 ? 's' : ''} na mesma empresa` +
        (fus.atualizados ? ` (${fmt(fus.atualizados)} substituído${fus.atualizados > 1 ? 's' : ''} pelo registro mais completo)` : '')
      : '';
    const resumo = MODO === 'add'
      ? `<b>${fmt(fus.novos)} contatos novos</b> acrescentados${detalhe} · base agora com <b>${fmt(ROWS.length)}</b> (antes ${fmt(antes)}).`
      : `<b>${fmt(ROWS.length)} contatos</b> carregados e pontuados${detalhe}.`;
    msg(comUF || !lidos.length ? 'ok' : 'warn', resumo +
      (ausentes.length ? `<br>Sem correspondência para: ${ausentes.map(k => LBL[k]).join(', ')} — os filtros que dependem dessas colunas ficam vazios.` : '') + geo);
    toast(MODO === 'add'
      ? `${fmt(fus.novos)} contatos acrescentados · base com ${fmt(ROWS.length)}`
      : `Base atualizada · ${fmt(ROWS.length)} contatos`);
    setTimeout(closeUpl, 1600);
  } catch (err) {
    console.error(err);
    msg('err', 'A carga não foi concluída: ' + esc(err.message || err));
  } finally {
    DB.busy = false; $('#file').disabled = false;
  }
}

function activateSavedBase(item) {
  ROWS = indexRows(marcarRepetidos(hydrate(item.pack)));
  SOURCE = { id: item.id, name: item.description, description: item.description, files: [item.filename],
    when: new Date(item.imported_at), n: item.record_count, importedBy: item.imported_by, local: false };
  SEL.clear(); F = BLANK(); page = 1;
  for (const id of ['q', 'emin', 'emax', 'cisearch', 'rmin', 'rmax', 'exq', 'mapbusca']) if ($('#' + id)) $('#' + id).value = '';
  document.querySelectorAll('[data-preset]').forEach(x => x.setAttribute('aria-pressed', 'false'));
  render();
}

function clearSavedBase() {
  if (!SOURCE?.id) return;
  ROWS = indexRows(hydrate(PACK)); SOURCE = null; SEL.clear(); F = BLANK(); page = 1;
  for (const id of ['q', 'emin', 'emax', 'cisearch', 'rmin', 'rmax', 'exq', 'mapbusca']) if ($('#' + id)) $('#' + id).value = '';
  render();
}

window.ingest = ingest;

/* ═══════════════ MAPA DO BRASIL ═══════════════ */
const RAMPA = ['#EDF3F7', '#CBDEEA', '#9DC0D6', '#6996BA', '#376E9B', '#0D305D'];
const UFLBL = uf => UFNOME[uf] + ' (' + uf + ')';
let mapaPronto = false;
function buildMap() {
  const svg = $('#mapa');
  svg.setAttribute('viewBox', `0 0 ${MAPA.w} ${MAPA.h}`);
  svg.innerHTML = Object.keys(MAPA.p).sort().map(uf =>
    `<path class="uf" id="uf-${uf}" data-uf="${uf}" d="${MAPA.p[uf]}"><title>${esc(UFNOME[uf])}</title></path>`).join('');
  $('#mapleg').innerHTML =
    `<div class="mapleg__bar">${RAMPA.map(c => `<span style="background:${c}"></span>`).join('')}</div>
     <div class="mapleg__lbl"><span>sem prospect</span><span id="legmax">—</span></div>`;
  const box = $('#mapbox');
  svg.addEventListener('mousemove', e => {
    const p = e.target.closest('path[data-uf]');
    if (!p) return hideTip();
    showTip(p.dataset.uf, e.clientX, e.clientY, box);
  });
  svg.addEventListener('mouseleave', hideTip);
  svg.addEventListener('click', e => {
    const p = e.target.closest('path[data-uf]');
    if (!p) return;
    const uf = p.dataset.uf, lbl = UFLBL(uf);
    const n = MAPCOUNT[uf] || 0;
    if (e.shiftKey) {
      if (F.exc.est.has(lbl)) F.exc.est.delete(lbl); else { F.exc.est.add(lbl); F.est.delete(lbl); }
    } else {
      if (!n && !F.est.has(lbl)) { toast(`Nenhum prospect em ${UFNOME[uf]} neste recorte`); return; }
      toggle(F.est, lbl); F.exc.est.delete(lbl);
    }
    hideTip(); page = 1; render();
  });
  mapaPronto = true;
}
function hideTip() { $('#maptip').hidden = true; }
function showTip(uf, cx, cy, box) {
  const tip = $('#maptip'), r = box.getBoundingClientRect();
  const n = MAPCOUNT[uf] || 0, lbl = UFLBL(uf);
  const cor = F.exc.est.has(lbl) ? '#D9AD9F' : (F.est.has(lbl) ? 'var(--amber)' : corDe(n));
  const emp = MAPEMP[uf] || 0;
  tip.innerHTML = `<div class="maptip__h"><i style="background:${cor}"></i>${esc(UFNOME[uf])}</div>
    <div class="maptip__v">${fmt(n)}</div>
    <div class="maptip__s">${n === 1 ? 'prospect' : 'prospects'}${emp ? ' · ' + fmt(emp) + (emp === 1 ? ' empresa' : ' empresas') : ''}</div>`;
  tip.hidden = false;
  let x = cx - r.left + 14, y = cy - r.top + 14;
  if (x + tip.offsetWidth > r.width) x = cx - r.left - tip.offsetWidth - 14;
  if (y + tip.offsetHeight > r.height) y = cy - r.top - tip.offsetHeight - 14;
  tip.style.left = Math.max(0, x) + 'px';
  tip.style.top = Math.max(0, y) + 'px';
}
let MAPMAX = 1, MAPCOUNT = {}, MAPEMP = {};
function corDe(n) {
  if (!n) return RAMPA[0];
  const t = Math.log1p(n) / Math.log1p(MAPMAX);
  return RAMPA[Math.min(RAMPA.length - 1, 1 + Math.floor(t * (RAMPA.length - 1.001)))];
}
function geoIndice() {
  const ci = new Map(), est = new Map();
  ROWS.forEach(r => {
    if (r.ci) { const o = ci.get(r.ci) || { n: 0, uf: r.uf }; o.n++; ci.set(r.ci, o); }
    if (r.est) est.set(r.est, (est.get(r.est) || 0) + 1);
  });
  return { ci, est };
}
function renderGeoSug() {
  const inp = $('#mapbusca'), cont = $('#mapsug');
  if (!inp) return;
  const q = norm(inp.value.trim());
  if (q.length < 2) { cont.hidden = true; cont.innerHTML = ''; return; }
  const { ci, est } = geoIndice();
  // casa no começo do nome ou no começo de qualquer palavra — evita que
  // "rio" traga "Exterior" pelo miolo da palavra
  const casa = txt => {
    const t = norm(txt);
    if (t.startsWith(q)) return 0;
    return t.split(/[^a-z0-9]+/).some(p => p.startsWith(q)) ? 1 : -1;
  };
  const hits = [];
  [...est.entries()].map(([e, n]) => [e, n, casa(e)]).filter(x => x[2] >= 0)
    .sort((a, b) => a[2] - b[2] || b[1] - a[1]).slice(0, 3)
    .forEach(([e, n]) => hits.push({ t: 'est', v: e, lbl: e, tipo: 'Estado', n }));
  [...ci.entries()].map(([c, o]) => [c, o, casa(c)]).filter(x => x[2] >= 0)
    .sort((a, b) => a[2] - b[2] || b[1].n - a[1].n).slice(0, 7)
    .forEach(([c, o]) => hits.push({ t: 'ci', v: c, lbl: c + (o.uf ? ` (${o.uf})` : ''), tipo: 'Município', n: o.n }));
  cont.hidden = false;
  cont.innerHTML = hits.length
    ? hits.map((h, k) => `<button data-geo="${h.t}" data-v="${esc(h.v)}"${k === 0 ? ' class="sel"' : ''}><span class="tipo">${h.tipo}</span><b>${esc(h.lbl)}</b><span class="qtd">${fmt(h.n)}</span></button>`).join('')
    : `<div class="nada">Nada encontrado para “${esc(inp.value.trim())}” nesta base.</div>`;
}
function renderGeoChips() {
  const el = $('#mapchips');
  if (!el) return;
  const chips = [...F.est].map(v => ['est', v]).concat([...F.ci].map(v => ['ci', v]));
  el.innerHTML = chips.map(([t, v]) =>
    `<span class="geochip">${esc(v)}<button data-geox="${t}" data-v="${esc(v)}" aria-label="Remover ${esc(v)}">×</button></span>`).join('') +
    (VIEW.length === 0 && F.est.size && F.ci.size
      ? '<span class="geoaviso">Município e estado estão sendo exigidos ao mesmo tempo. Remova um dos dois para ver resultados.</span>'
      : '');
}
function renderMap(rows) {
  if (!mapaPronto) buildMap();
  MAPCOUNT = {}; MAPEMP = {};
  const emp = {};
  (rows || VIEW).forEach(r => {
    if (!r.uf) return;
    MAPCOUNT[r.uf] = (MAPCOUNT[r.uf] || 0) + 1;
    (emp[r.uf] = emp[r.uf] || new Set()).add(r.c.toLowerCase());
  });
  for (const uf in emp) MAPEMP[uf] = emp[uf].size;
  MAPMAX = Math.max(1, ...Object.values(MAPCOUNT));
  Object.keys(MAPA.p).forEach(uf => {
    const el = document.getElementById('uf-' + uf);
    if (!el) return;
    const lbl = UFLBL(uf), n = MAPCOUNT[uf] || 0;
    const sel = F.est.has(lbl), ex = F.exc.est.has(lbl);
    el.setAttribute('class', 'uf' + (n || sel || ex ? ' uf--on' : '') +
      (sel ? ' uf--sel' : '') + (ex ? ' uf--ex' : ''));
    el.style.fill = (F.est.has(lbl) || F.exc.est.has(lbl)) ? '' : corDe(n);
    el.querySelector('title').textContent = `${UFNOME[uf]} — ${fmt(n)} ${n === 1 ? 'prospect' : 'prospects'}`;
  });
  renderGeoChips();
  const lm = $('#legmax');
  if (lm) lm.textContent = fmt(MAPMAX) + (MAPMAX === 1 ? ' prospect' : ' prospects');

  const semEstado = Object.keys(MAPCOUNT).length === 0;
  const aviso = $('#mapavazio');
  if (semEstado && ROWS.length) {
    if (!aviso) {
      const el = document.createElement('div');
      el.id = 'mapavazio'; el.className = 'mapavazio';
      el.innerHTML = 'Nenhum estado identificado nesta base.<br><span>Verifique se a planilha tem uma coluna <code>State</code> ou <code>Estado</code> com valores como <code>SP</code> ou <code>São Paulo</code>.</span>';
      $('#mapbox').appendChild(el);
    }
  } else if (aviso) aviso.remove();

  const ativo = filtrosAtivos();
  const btn = $('#verTudo');
  btn.disabled = !ativo;
  btn.title = ativo ? 'Remover todos os filtros e voltar à base completa' : 'Já exibindo a base completa';
  const semUF = VIEW.filter(r => !r.uf).length;
  const fora = semUF ? ` · ${fmt(semUF)} sem estado identificado, fora do mapa` : '';
  $('#mapsub').innerHTML = ativo
    ? `Exibindo <b>${fmt(VIEW.length)}</b> de <b>${fmt(ROWS.length)}</b> prospects da base${fora}`
    : `Base completa: <b>${fmt(ROWS.length)}</b> prospects em <b>${fmt(Object.keys(MAPCOUNT).length)}</b> estados${fora}`;
}

function renderStamp() {
  const b = $('#build');
  if (b) { b.textContent = 'v' + APP_BUILD; b.title = 'Versão do código deste arquivo. Ao gerar um novo app, esta versão é mantida — o que muda é a base de dados.'; }
  const el = $('#stamp');
  const fdate = (d, hora) => d.toLocaleString('pt-BR', hora
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (SOURCE) {
    el.className = 'stamp stamp--live';
    el.innerHTML = `<i></i>Importada em ${fdate(SOURCE.when, true)}`;
    el.title = `Base carregada do arquivo ${SOURCE.name} · código v${APP_BUILD}`;
  } else {
    const d = new Date(BASE_DATE + 'T12:00:00');
    el.className = 'stamp';
    el.innerHTML = `<i></i>Atualizada em ${isNaN(d) ? BASE_DATE : fdate(d, false)}`;
    el.title = `Data da carga embutida neste arquivo · código v${APP_BUILD}`;
  }
}

function renderExc() {
  const bar = $('#excbar');
  const chips = [];
  for (const k in F.exc) F.exc[k].forEach(v => chips.push(
    `<span class="exchip"><b>${EXLBL[k]}:</b> ${esc(v || '—')}<button data-unex="${k}" data-v="${esc(v)}" aria-label="Remover exclusão">×</button></span>`));
  F.exq.forEach(w => chips.push(
    `<span class="exchip"><b>Cargo contém:</b> ${esc(w)}<button data-unexq="${esc(w)}" aria-label="Remover exclusão">×</button></span>`));
  if (!chips.length) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  const fora = ROWS.length - ROWS.filter(r => {
    for (const k in F.exc) {
      const s = F.exc[k]; if (!s.size) continue;
      if (k === 'dp') { if (r.dp.some(x => s.has(x))) return false; }
      else if (s.has(r[k])) return false;
    }
    return !(F.exqn.length && F.exqn.some(w => r.tk.includes(w)));
  }).length;
  bar.innerHTML = `<span class="excbar__t">Excluindo</span>${chips.join('')}<span class="excbar__t" style="letter-spacing:0;text-transform:none;font-family:var(--sans);font-size:12px">${fmt(fora)} contatos fora da lista</span><button class="excbar__clr" id="clrexc">limpar exclusões</button>`;
  $('#clrexc').addEventListener('click', () => {
    for (const k in F.exc) F.exc[k].clear();
    F.exq = []; F.exqn = []; $('#exq').value = ''; page = 1; render();
  });
}

function renderSource() {
  const bar = $('#srcbar');
  if (!SOURCE) { bar.hidden = true; return; }
  bar.hidden = false;
  const d = SOURCE.when.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const listaArq = SOURCE.files && SOURCE.files.length > 1
    ? `<b>${esc(SOURCE.name)}</b> (${SOURCE.files.map(esc).join(' + ')})` : `<b>${esc(SOURCE.name)}</b>`;
  bar.innerHTML = `<span>Exibindo ${listaArq} · ${fmt(SOURCE.n)} contatos · importada em ${d}${SOURCE.importedBy ? ' · ' + esc(SOURCE.importedBy) : ''}${SOURCE.local ? ' · somente nesta sessão' : ' · preservada no banco'}</span>
    <span class="srcbar__r">
      <button class="btn" id="saveApp" title="Gera uma cópia DESTE arquivo com a base atual embutida. O código gerado é o deste arquivo (v${APP_BUILD}), não uma versão mais nova.">Gerar app com esta base</button>
      <button class="btn" id="restore">Voltar à base original</button>
    </span>`;
  $('#restore').addEventListener('click', () => {
    ROWS = indexRows(hydrate(PACK)); SOURCE = null; SEL.clear(); F = BLANK(); page = 1;
    $('#q').value = ''; $('#cisearch').value = ''; $('#emin').value = ''; $('#emax').value = ''; $('#rmin').value = ''; $('#rmax').value = ''; $('#exq').value = ''; if ($('#mapbusca')) $('#mapbusca').value = '';
    render(); toast('Base original restaurada');
  });
  $('#saveApp').addEventListener('click', saveApp);
}

/* regenera o próprio arquivo HTML com a nova base embutida */
function saveApp() {
  try {
    const marker = 'const PACK = ';
    const i = SELF_BODY.indexOf(marker), j = SELF_BODY.indexOf('/*PACK_END*/');
    if (i < 0 || j < 0) throw new Error('marcadores ausentes');
    let novo = SELF_BODY.slice(0, i + marker.length) + JSON.stringify(ING.pack(ROWS)).replace(/</g, '\\u003c') + ';\n' + SELF_BODY.slice(j);
    const dm = 'const BASE_DATE = ', di = novo.indexOf(dm), dj = novo.indexOf('/*DATE_END*/');
    if (di >= 0 && dj > di) {
      const hoje = (SOURCE ? SOURCE.when : new Date()).toISOString().slice(0, 10);
      novo = novo.slice(0, di + dm.length) + `'${hoje}'; ` + novo.slice(dj);
    }
    const html = '<!DOCTYPE html>\n<html lang="pt-BR">\n' + SELF_HEAD + '\n<body>\n' + novo + '\n</body>\n</html>';
    download(new Blob([html], { type: 'text/html;charset=utf-8' }), `OnSet_Console_Decisores_${stamp()}.html`);
    toast('Novo app gerado com a base atualizada');
  } catch (err) {
    console.error(err);
    toast('Não foi possível gerar o app — use a exportação em Excel');
  }
}

/* ═══════════════ DOSSIÊ DE ABORDAGEM ═══════════════
   Dois blocos apenas: o que a base sabe de fato sobre a conta,
   e a análise de empresa e mercado feita com IA + busca web. */

function mapaDaConta(r) {
  const mesma = ROWS.filter(x => x.c && x.c.toLowerCase() === r.c.toLowerCase());
  return { total: mesma.length, ti: mesma.filter(x => x.ti).length, pares: mesma.filter(x => x.i !== r.i) };
}
function benchSetor(r) {
  const mesmo = ROWS.filter(x => x.ind === r.ind);
  const empresas = new Set(mesmo.map(x => x.c.toLowerCase())).size;
  const ranking = [...new Set(ROWS.map(x => x.ind))]
    .map(sx => [sx, ROWS.filter(x => x.ind === sx).length])
    .sort((a, b) => b[1] - a[1]);
  return { contatos: mesmo.length, empresas, pos: ranking.findIndex(x => x[0] === r.ind) + 1, total: ranking.length };
}

function abrirDossie(i) {
  const r = ROWS[i];
  const conta = mapaDaConta(r);
  const li = r.li ? `<a class="btn" href="${esc(r.li)}" target="_blank" rel="noopener">Abrir LinkedIn</a>` : '';
  const busca = `<a class="btn" href="https://www.google.com/search?q=${encodeURIComponent('"' + r.c + '" notícias')}" target="_blank" rel="noopener">Buscar notícias</a>`;

  $('#dsTitulo').textContent = r.n;
  $('#dsSub').textContent = `${r.t} · ${r.c}`;
  $('#dsCorpo').innerHTML = `
    <div class="ds__linha">
      <span class="tier tier--${r.tr}">${r.tr}</span>
      <span class="tag">${esc(r.f)}</span>
      <span class="tag">${esc(r.ind)}</span>
      <span class="tag">${esc(r.pt)}${r.em ? ' · ' + fmt(r.em) + ' func.' : ''}</span>
      ${r.loc ? `<span class="tag">${esc(r.loc)}</span>` : ''}
      ${r.ti ? '<span class="tag tag--ti">Decisor de TI</span>' : ''}
    </div>

    <h3 class="ds__h">Mapa da conta — ${esc(r.c)}</h3>
    <p class="ds__p">${conta.total === 1
      ? 'Único contato desta empresa na base.'
      : `<b>${fmt(conta.total)} contatos</b> desta empresa na base, sendo <b>${fmt(conta.ti)}</b> em TI.`}</p>
    ${conta.pares.length ? `<div class="ds__pares">${conta.pares.slice(0, 12).map(pr =>
      `<button class="ds__par${pr.ti ? ' ds__par--ti' : ''}" data-dossie="${pr.i}" title="Abrir dossiê de ${esc(pr.n)}"><b>${esc(pr.n)}</b><span>${esc(pr.t)}</span></button>`).join('')}
      ${conta.pares.length > 12 ? `<span class="ds__mais">+${conta.pares.length - 12} outros</span>` : ''}</div>` : ''}

    <h3 class="ds__h">Análise de empresa e mercado <span class="ia__tag">IA + busca web</span></h3>
    <div class="ia__barra">
      <button class="btn btn--primary" id="iaBtn" data-ia="${r.i}">Analisar ${esc(r.c)}</button>
      <button class="btn" id="iaCfg">Chave da API</button>
    </div>
    <div id="iaResultado"></div>
  `;
  $('#dsAcoes').innerHTML = `${li}${busca}
    ${r.e ? `<button class="btn" data-mail="${esc(r.e)}">Escrever e-mail</button>` : ''}`;
  $('#dossie').classList.add('on');
  $('#dossie').setAttribute('aria-hidden', 'false');
  if (IA_KEY) analisarIA(i);          // com chave carregada, já começa a análise
}
function fecharDossie() {
  $('#dossie').classList.remove('on');
  $('#dossie').setAttribute('aria-hidden', 'true');
}
document.addEventListener('click', e => {
  const ab = e.target.closest('[data-dossie]');
  if (ab) { abrirDossie(+ab.dataset.dossie); return; }
  const ia = e.target.closest('[data-ia]');
  if (ia) { analisarIA(+ia.dataset.ia); return; }
  if (e.target.id === 'iaCfg') { iaConfig(false); return; }
  if (e.target.id === 'dossie' || e.target.id === 'dsX') fecharDossie();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDossie(); });

/* ═══════════════ ANÁLISE DE EMPRESA E MERCADO COM IA ═══════════════
   Usa a API da Anthropic COM busca web do lado do servidor. A busca é o
   ponto central: sem ela o modelo inventaria fatos sobre a empresa. */

let IA_KEY = '';                       // só em memória, nunca gravada
let IA_MODELO = 'claude-sonnet-4-6';
const IA_CACHE = new Map();            // por empresa, dentro da sessão

const IA_SISTEMA = `Você é analista de inteligência comercial da OnSet Tecnologia, empresa brasileira de Serviços Gerenciados de Infraestrutura de TI (SGTI) sediada em São José dos Campos. Seu trabalho é preparar um vendedor para abordar um executivo específico.

REGRA ABSOLUTA — PROCEDÊNCIA DOS FATOS
1. Use a ferramenta de busca ANTES de afirmar qualquer coisa sobre a empresa. Faça buscas separadas para: (a) a empresa e seus movimentos recentes, (b) o setor dela no Brasil, (c) iniciativas de tecnologia, dados ou infraestrutura dessa empresa.
2. Toda afirmação factual sobre a empresa — faturamento, aquisição, investimento, número de unidades, incidente, projeto, troca de executivo — tem que vir de um resultado de busca. Se você não encontrou, NÃO afirme.
3. É proibido estimar, arredondar ou deduzir número que você não leu na fonte. Nunca escreva "provavelmente", "deve ter", "estima-se" como se fosse fato.
4. Homônimos são risco real: confirme que a fonte fala da empresa brasileira correta, no setor informado. Na dúvida, descarte a fonte.
5. O que não foi possível confirmar vai no campo "lacunas", não no texto da análise.
6. Se a busca não trouxer nada útil sobre a empresa, diga isso abertamente, marque confianca "baixa" e trabalhe só com o setor. Uma análise honesta e curta vale mais que uma inventada.

O QUE INTERESSA À ONSET
Sinais de que a operação de TI está sob pressão: crescimento acelerado, fusão ou aquisição, abertura de unidades, migração de ERP ou nuvem, incidente de segurança, exigência regulatória, contratação ou saída de liderança de TI, modernização industrial, expansão de e-commerce. Conecte o que encontrou a uma dor concreta de infraestrutura, suporte, monitoramento ou continuidade.

TOM
Português do Brasil, direto, sem jargão de marketing e sem superlativo. Escreva para um vendedor sênior ler em dois minutos antes de uma ligação.

SAÍDA
Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem cercas de código. Formato exato:
{
  "empresa": {
    "resumo": "2 a 3 frases sobre o que a empresa faz e seu posicionamento, só com o que foi confirmado",
    "operacao": "como a operação dela funciona e onde a TI é crítica",
    "movimentos": ["fato recente confirmado, com o ano quando houver"],
    "sinais_ti": ["evidência de projeto, dor ou investimento em tecnologia"],
    "confianca": "alta | media | baixa"
  },
  "mercado": {
    "panorama": "situação do setor no Brasil hoje, 2 a 3 frases",
    "pressoes": ["pressão concreta que o setor sofre"],
    "tendencias_ti": ["movimento de tecnologia relevante nesse setor"]
  },
  "implicacoes": ["o que isso significa para uma venda de serviços gerenciados de TI nessa conta"],
  "abordagem": {
    "angulo": "o ângulo de entrada recomendado para ESTE cargo nesta empresa",
    "gancho": "uma frase de abertura ancorada em fato confirmado",
    "email_assunto": "assunto curto e específico",
    "email_corpo": "e-mail de no máximo 150 palavras, em primeira pessoa, sem promessa de resultado, terminando com pedido de 30 minutos",
    "linkedin": "mensagem de no máximo 300 caracteres"
  },
  "proposta": {
    "escopo": "o primeiro passo concreto a propor",
    "porque": "por que este escopo para esta empresa",
    "proximo_passo": "o que pedir ao final da conversa"
  },
  "lacunas": ["o que não foi possível confirmar e precisa ser checado na call"]
}`;

function iaPrompt(r, conta, bench) {
  const pares = conta.pares.slice(0, 6).map(p => `${p.n} (${p.t})`).join('; ');
  return `Prepare a abordagem para este contato.

CONTATO
Nome: ${r.n}
Cargo: ${r.t}
Família do cargo: ${r.f} — senioridade ${r.sen}
É decisor de TI: ${r.ti ? 'sim' : 'não'}
Departamentos: ${r.dp.join(', ') || 'não informado'}
Local: ${r.loc || 'não informado'}

EMPRESA
Nome: ${r.c}
Setor (classificação da nossa base): ${r.ind}
Porte: ${r.pt}${r.em ? ` — ${r.em} funcionários` : ''}
${r.rev ? `Faturamento anual informado: US$ ${r.rev}` : ''}

CONTEXTO DA NOSSA BASE
Contatos que temos nessa empresa: ${conta.total}${conta.ti ? `, sendo ${conta.ti} em TI` : ', nenhum em TI'}
${pares ? `Outros nomes: ${pares}` : ''}
O setor ${r.ind} representa ${bench.contatos} contatos em ${bench.empresas} empresas na nossa base.

Busque informações atuais sobre ${r.c} e sobre o setor ${r.ind} no Brasil, e devolva o JSON no formato especificado.`;
}

async function analisarIA(i) {
  const r = ROWS[i];
  const box = $('#iaResultado');
  if (!IA_KEY) { iaConfig(true); return; }

  const chave = r.c.toLowerCase() + '|' + r.f;
  if (IA_CACHE.has(chave)) { iaRender(IA_CACHE.get(chave), r); return; }

  box.innerHTML = `<div class="ia__load"><span class="ia__spin"></span>Buscando informações sobre ${esc(r.c)} e sobre o setor… isso leva de 20 a 60 segundos.</div>`;
  $('#iaBtn').disabled = true;

  const conta = mapaDaConta(r), bench = benchSetor(r);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': IA_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: IA_MODELO,
        max_tokens: 4000,
        system: IA_SISTEMA,
        messages: [{ role: 'user', content: iaPrompt(r, conta, bench) }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(iaErro(resp.status, txt));
    }
    const data = await resp.json();

    // texto final + fontes citadas (a documentação exige exibir as citações)
    let texto = '', fontes = new Map(), buscas = 0;
    (data.content || []).forEach(b => {
      if (b.type === 'text') {
        texto += b.text;
        (b.citations || []).forEach(c => { if (c.url) fontes.set(c.url, c.title || c.url); });
      }
      if (b.type === 'server_tool_use') buscas++;
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        b.content.forEach(x => { if (x.url) fontes.set(x.url, x.title || x.url); });
      }
    });
    const limpo = texto.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let j;
    try { j = JSON.parse(limpo); }
    catch (e) {
      const m = limpo.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('A resposta não veio no formato esperado. Tente novamente.');
      j = JSON.parse(m[0]);
    }
    j.__fontes = [...fontes.entries()].slice(0, 12);
    j.__buscas = buscas;
    IA_CACHE.set(chave, j);
    iaRender(j, r);
  } catch (err) {
    const rede = /failed to fetch|networkerror|load failed|cors/i.test(err.message || '');
    box.innerHTML = `<div class="ia__erro"><b>Não foi possível concluir a análise.</b><br>${esc(err.message || String(err))}` +
      (rede ? `<br><br>O navegador bloqueou a chamada. Isso costuma acontecer quando o arquivo é aberto direto do disco (endereço começando com <code>file://</code>), porque a API não aceita requisição sem origem definida.<br><br><b>Como resolver:</b> sirva o arquivo por HTTP. Na pasta onde ele está, rode <code>python -m http.server 8000</code> e abra <code>http://localhost:8000</code>. Todo o resto do app funciona normalmente offline — só esta análise precisa de rede.` : '') +
      `</div>`;
  } finally {
    $('#iaBtn').disabled = false;
  }
}

function iaErro(status, txt) {
  if (status === 401) return 'Chave recusada (401). Confira se a chave está correta e ativa.';
  if (status === 403) return 'Acesso negado (403). A busca web precisa estar habilitada no Console da Anthropic para a sua organização.';
  if (status === 429) return 'Limite de requisições atingido (429). Aguarde um instante e tente de novo.';
  if (status === 400 && /credit|balance/i.test(txt)) return 'Sem créditos na conta da API.';
  if (status >= 500) return 'A API respondeu com erro temporário. Tente novamente.';
  return `A API respondeu ${status}. ${String(txt).slice(0, 180)}`;
}

const CONF = { alta: ['Confiança alta', '#1E5C33', '#EAF6EE'], media: ['Confiança média', '#7A4E00', '#FFF6E6'], baixa: ['Confiança baixa', '#8A2222', '#FDECEC'] };
function li(arr) { return (arr && arr.length) ? `<ul class="ia__ul">${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="ia__vazio">Nada confirmado.</p>'; }

function iaRender(j, r) {
  const c = CONF[(j.empresa && j.empresa.confianca) || 'baixa'] || CONF.baixa;
  const e = j.empresa || {}, m = j.mercado || {}, a = j.abordagem || {}, p = j.proposta || {};
  $('#iaResultado').innerHTML = `
    <div class="ia__sel" style="color:${c[1]};background:${c[2]}">${c[0]} · ${j.__buscas || 0} busca${(j.__buscas || 0) === 1 ? '' : 's'} na web</div>

    <h4 class="ia__h">A empresa</h4>
    <p class="ia__p">${esc(e.resumo || '—')}</p>
    ${e.operacao ? `<p class="ia__p">${esc(e.operacao)}</p>` : ''}
    <div class="ia__sub">Movimentos recentes</div>${li(e.movimentos)}
    <div class="ia__sub">Sinais de tecnologia</div>${li(e.sinais_ti)}

    <h4 class="ia__h">O mercado</h4>
    <p class="ia__p">${esc(m.panorama || '—')}</p>
    <div class="ia__sub">Pressões do setor</div>${li(m.pressoes)}
    <div class="ia__sub">Tendências de TI</div>${li(m.tendencias_ti)}

    <h4 class="ia__h">O que isso significa para a OnSet</h4>
    ${li(j.implicacoes)}

    <h4 class="ia__h">Abordagem recomendada</h4>
    <p class="ia__p"><b>Ângulo:</b> ${esc(a.angulo || '—')}</p>
    <p class="ia__p"><b>Gancho:</b> ${esc(a.gancho || '—')}</p>
    <div class="ds__msg">
      <div class="ds__msgh">E-mail sugerido <button class="ds__copy" id="iaCopiaEmail">copiar</button></div>
      <div class="ds__assunto">Assunto: ${esc(a.email_assunto || '')}</div>
      <pre>${esc(a.email_corpo || '')}</pre>
    </div>
    <div class="ds__msg">
      <div class="ds__msgh">LinkedIn <button class="ds__copy" id="iaCopiaLi">copiar</button></div>
      <pre>${esc(a.linkedin || '')}</pre>
    </div>

    <h4 class="ia__h">Proposta de primeiro passo</h4>
    <div class="ds__oferta"><b>${esc(p.escopo || '—')}</b><span>${esc(p.porque || '')}</span></div>
    ${p.proximo_passo ? `<p class="ia__p"><b>Fechar pedindo:</b> ${esc(p.proximo_passo)}</p>` : ''}

    <h4 class="ia__h">Checar na conversa</h4>
    ${li(j.lacunas)}

    <h4 class="ia__h">Fontes consultadas</h4>
    ${j.__fontes && j.__fontes.length
      ? `<ol class="ia__fontes">${j.__fontes.map(([u, t]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ol>`
      : '<p class="ia__vazio">Nenhuma fonte retornada — trate a análise como hipótese, não como fato.</p>'}
    <p class="ds__rodape">Gerado por IA com busca na web. Confira os fatos nas fontes antes de usar em uma abordagem: o modelo pode interpretar mal uma fonte ou confundir empresas de nome parecido.</p>
  `;
  $('#iaCopiaEmail').onclick = () => copy(`Assunto: ${a.email_assunto || ''}\n\n${a.email_corpo || ''}`, 'E-mail copiado');
  $('#iaCopiaLi').onclick = () => copy(a.linkedin || '', 'Mensagem copiada');
}

function iaConfig(forcar) {
  const box = $('#iaResultado');
  box.innerHTML = `
    <div class="ia__cfg">
      ${forcar ? '<p class="ia__p"><b>Informe uma chave da API para continuar.</b></p>' : ''}
      <label class="ia__lbl">Chave da API da Anthropic</label>
      <input type="password" id="iaChave" placeholder="sk-ant-..." autocomplete="off" value="${esc(IA_KEY)}">
      <label class="ia__lbl">Modelo</label>
      <input type="text" id="iaModelo" value="${esc(IA_MODELO)}">
      <button class="btn btn--primary" id="iaSalvar">Usar esta chave</button>
      <p class="ia__aviso"><b>A chave fica apenas na memória desta aba.</b> Não é gravada no arquivo nem no navegador, e some ao fechar. Use uma chave com limite de gasto definido no Console — qualquer pessoa com acesso a esta aba pode consumi-la. A busca web precisa estar habilitada na sua organização e é cobrada por busca, além dos tokens.</p>
    </div>`;
  $('#iaSalvar').onclick = () => {
    IA_KEY = $('#iaChave').value.trim();
    IA_MODELO = $('#iaModelo').value.trim() || IA_MODELO;
    if (!IA_KEY) return toast('Informe a chave');
    $('#iaResultado').innerHTML = '';
    $('#iaBtn').hidden = false;
    toast('Chave carregada nesta sessão');
  };
}

render();
DB.init('__API_URL__');

