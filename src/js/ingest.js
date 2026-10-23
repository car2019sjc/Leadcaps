/* ═══════════════════════════════════════════════════════════
   INGESTÃO — lê CSV/XLSX, normaliza e pontua no navegador,
   com as mesmas regras usadas para montar a base embutida.
   ═══════════════════════════════════════════════════════════ */
const ING = (function () {

  const sa = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const low = s => sa(s).trim().toLowerCase();

  /* ---------- leitura de arquivo ---------- */
  function decode(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) { return new TextDecoder('windows-1252').decode(buf); }
  }
  function sniff(line) {
    const cand = [';', ',', '\t', '|'];
    let best = ';', n = -1;
    cand.forEach(d => { const c = line.split(d).length; if (c > n) { n = c; best = d; } });
    return best;
  }
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const nl = text.indexOf('\n');
    const d = sniff(nl < 0 ? text : text.slice(0, nl));
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === d) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim());
    return rows.filter(r => r.some(c => c && c.trim()))
      .map(r => { const o = {}; head.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
  }

  /* ---------- leitura de .xlsx (zip + inflate nativo) ---------- */
  async function parseXLSX(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eo = -1;
    for (let i = buf.byteLength - 22; i >= 0 && i > buf.byteLength - 66000; i--)
      if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
    if (eo < 0) throw new Error('Arquivo .xlsx inválido.');
    let p = dv.getUint32(eo + 16, true);
    const n = dv.getUint16(eo + 10, true), entries = {};
    for (let k = 0; k < n; k++) {
      const nameLen = dv.getUint16(p + 28, true), exLen = dv.getUint16(p + 30, true),
        cmLen = dv.getUint16(p + 32, true), method = dv.getUint16(p + 10, true),
        csize = dv.getUint32(p + 20, true), off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      entries[name] = { method, csize, off };
      p += 46 + nameLen + exLen + cmLen;
    }
    async function read(name) {
      const e = entries[name]; if (!e) return null;
      const nl = dv.getUint16(e.off + 26, true), xl = dv.getUint16(e.off + 28, true);
      const start = e.off + 30 + nl + xl;
      const raw = u8.subarray(start, start + e.csize);
      if (e.method === 0) return new TextDecoder().decode(raw);
      if (typeof DecompressionStream !== 'function')
        throw new Error('Este navegador não abre .xlsx. Exporte a planilha como CSV.');
      const ds = new DecompressionStream('deflate-raw');
      const out = new Blob([raw]).stream().pipeThrough(ds);
      return new TextDecoder().decode(await new Response(out).arrayBuffer());
    }
    const dom = s => new DOMParser().parseFromString(s, 'application/xml');
    const sstXml = await read('xl/sharedStrings.xml');
    const sst = sstXml ? [...dom(sstXml).getElementsByTagName('si')]
      .map(si => [...si.getElementsByTagName('t')].map(t => t.textContent).join('')) : [];
    let sheet = Object.keys(entries).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
    if (!sheet) throw new Error('Nenhuma planilha encontrada no arquivo.');
    const doc = dom(await read(sheet));
    const grid = [...doc.getElementsByTagName('row')].map(r => {
      const arr = [];
      [...r.getElementsByTagName('c')].forEach(c => {
        const ref = (c.getAttribute('r') || '').replace(/\d+/g, '');
        let ci = 0; for (const ch of ref) ci = ci * 26 + (ch.charCodeAt(0) - 64);
        ci = Math.max(0, ci - 1);
        const t = c.getAttribute('t');
        let v = '';
        if (t === 'inlineStr') v = (c.getElementsByTagName('t')[0] || {}).textContent || '';
        else { const vn = c.getElementsByTagName('v')[0]; v = vn ? vn.textContent : ''; if (t === 's') v = sst[+v] || ''; }
        arr[ci] = String(v).trim();
      });
      return arr;
    }).filter(r => r.some(c => c));
    const head = (grid.shift() || []).map(h => (h || '').trim());
    return grid.map(r => { const o = {}; head.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
  }

  async function readFile(file) {
    const buf = await file.arrayBuffer();
    if (/\.xlsx?$/i.test(file.name)) return parseXLSX(buf);
    return parseCSV(decode(buf));
  }

  /* ---------- mapeamento de colunas ---------- */
  const ALIAS = {
    first: ['first name', 'firstname', 'nome', 'primeiro nome'],
    last: ['last name', 'lastname', 'sobrenome', 'ultimo nome'],
    full: ['name', 'full name', 'nome completo', 'contato'],
    title: ['title', 'cargo', 'job title', 'position', 'funcao', 'headline'],
    company: ['company name', 'company', 'empresa', 'organization', 'organization name', 'account name', 'conta'],
    email: ['email', 'e-mail', 'email address', 'endereco de email', 'primary email'],
    dept: ['departamentos', 'departments', 'department', 'departamento', 'departments/functions'],
    emp: ['# employees', 'employees', 'employee count', 'funcionarios', 'numero de funcionarios', 'company size', 'porte', 'headcount'],
    ind: ['industry', 'setor', 'industria', 'segmento', 'company industry'],
    li: ['person linkedin url', 'linkedin url', 'linkedin', 'perfil linkedin', 'linkedin profile'],
    city: ['city', 'cidade', 'municipio', 'localidade', 'company city', 'contact city', 'person city', 'city name'],
    state: ['state', 'estado', 'uf', 'regiao', 'province', 'company state', 'contact state', 'person state',
            'state/province', 'province/state', 'state or province', 'state name', 'estado/uf', 'uf/estado',
            'estado (uf)', 'sigla', 'sigla uf', 'unidade federativa'],
    rev: ['annual revenue', 'annual revenue (usd)', 'anual revenue', 'revenue', 'company revenue', 'estimated annual revenue', 'receita anual', 'receita', 'faturamento', 'faturamento anual', 'faturamento estimado'],
  };
  const FUZZY = {
    state: [/\bstate\b/, /\bestado\b/, /\buf\b/, /province/],
    city: [/\bcity\b/, /cidade/, /munic/],
    rev: [/revenue/, /faturamento/, /receita/],
    emp: [/employee/, /funcionari/, /headcount/, /company size/],
    title: [/\btitle\b/, /\bcargo\b/, /position/],
    company: [/company/, /empresa/, /organization/, /account/],
    email: [/e-?mail/],
    li: [/linkedin/],
    ind: [/industry/, /setor/, /segmento/],
    dept: [/department/, /departamento/],
  };
  function mapCols(head) {
    const m = {}, used = new Set();
    for (const key in ALIAS) {
      const hit = head.find(h => !used.has(h) && ALIAS[key].includes(low(h)));
      if (hit) { m[key] = hit; used.add(hit); }
    }
    // 2ª passada: casa por palavra-chave no nome da coluna
    for (const key in FUZZY) {
      if (m[key]) continue;
      const hit = head.find(h => !used.has(h) && FUZZY[key].some(rx => rx.test(low(h))));
      if (hit) { m[key] = hit; used.add(hit); }
    }
    return m;
  }

  /* ---------- dicionários (espelham o pipeline original) ---------- */
  const UF = { 'sao paulo': 'SP', 'rio de janeiro': 'RJ', 'minas gerais': 'MG', 'parana': 'PR', 'rio grande do sul': 'RS', 'santa catarina': 'SC', 'bahia': 'BA', 'ceara': 'CE', 'pernambuco': 'PE', 'goias': 'GO', 'espirito santo': 'ES', 'distrito federal': 'DF', 'federal district': 'DF', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'para': 'PA', 'amazonas': 'AM', 'maranhao': 'MA', 'piaui': 'PI', 'rio grande do norte': 'RN', 'paraiba': 'PB', 'alagoas': 'AL', 'sergipe': 'SE', 'tocantins': 'TO', 'rondonia': 'RO', 'roraima': 'RR', 'acre': 'AC', 'amapa': 'AP', 'sp': 'SP', 'rj': 'RJ', 'mg': 'MG', 'pr': 'PR', 'rs': 'RS', 'sc': 'SC', 'ba': 'BA', 'ce': 'CE', 'pe': 'PE', 'go': 'GO', 'es': 'ES', 'df': 'DF', 'mt': 'MT', 'ms': 'MS', 'pa': 'PA', 'am': 'AM', 'ma': 'MA', 'pi': 'PI', 'rn': 'RN', 'pb': 'PB', 'al': 'AL', 'se': 'SE', 'to': 'TO', 'ro': 'RO', 'rr': 'RR', 'ac': 'AC', 'ap': 'AP' };
  const UF_NOME = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };
  const REG = {};
  ['SP', 'RJ', 'MG', 'ES'].forEach(u => REG[u] = 'Sudeste');
  ['PR', 'SC', 'RS'].forEach(u => REG[u] = 'Sul');
  ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'].forEach(u => REG[u] = 'Nordeste');
  ['MT', 'MS', 'GO', 'DF'].forEach(u => REG[u] = 'Centro-Oeste');
  ['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'].forEach(u => REG[u] = 'Norte');

  const FREE = new Set(['gmail.com', 'hotmail.com', 'yahoo.com.br', 'yahoo.com', 'outlook.com', 'uol.com.br', 'terra.com.br', 'bol.com.br', 'icloud.com', 'live.com', 'msn.com', 'me.com', 'globo.com', 'ig.com.br', 'aol.com', 'protonmail.com']);
  const VALE = new Set(['sao jose dos campos', 'jacarei', 'taubate', 'cacapava', 'pindamonhangaba', 'guaratingueta', 'caraguatatuba', 'tremembe', 'lorena', 'cruzeiro', 'ubatuba', 'sao sebastiao', 'aparecida']);

  const SECTOR = { 'information technology & services': ['Tecnologia da Informação', 16], 'computer software': ['Software', 14], 'internet': ['Internet / Digital', 13], 'computer & network security': ['Segurança da Informação', 18], 'telecommunications': ['Telecomunicações', 17], 'financial services': ['Serviços Financeiros', 18], 'banking': ['Bancos', 18], 'insurance': ['Seguros', 17], 'investment management': ['Gestão de Investimentos', 13], 'investment banking': ['Banco de Investimento', 12], 'capital markets': ['Mercado de Capitais', 12], 'venture capital & private equity': ['Venture Capital / PE', 8], 'accounting': ['Contabilidade', 10], 'hospital & health care': ['Saúde e Hospitais', 20], 'pharmaceuticals': ['Farmacêutico', 19], 'medical devices': ['Dispositivos Médicos', 16], 'biotechnology': ['Biotecnologia', 14], 'health, wellness & fitness': ['Saúde e Bem-estar', 11], 'retail': ['Varejo', 17], 'supermarkets': ['Supermercados', 18], 'consumer goods': ['Bens de Consumo', 14], 'food & beverages': ['Alimentos e Bebidas', 16], 'food production': ['Produção de Alimentos', 16], 'logistics & supply chain': ['Logística e Supply Chain', 18], 'transportation/trucking/railroad': ['Transporte e Logística', 16], 'airlines/aviation': ['Aviação', 15], 'maritime': ['Marítimo / Portuário', 14], 'construction': ['Construção Civil', 13], 'civil engineering': ['Engenharia Civil', 13], 'real estate': ['Imobiliário', 10], 'machinery': ['Máquinas e Equipamentos', 16], 'industrial automation': ['Automação Industrial', 18], 'automotive': ['Automotivo', 18], 'aviation & aerospace': ['Aeroespacial e Defesa', 20], 'defense & space': ['Defesa e Espaço', 20], 'mechanical or industrial engineering': ['Engenharia Industrial', 16], 'electrical/electronic manufacturing': ['Eletroeletrônico', 16], 'semiconductors': ['Semicondutores', 15], 'chemicals': ['Químico', 16], 'plastics': ['Plásticos', 14], 'paper & forest products': ['Papel e Celulose', 15], 'textiles': ['Têxtil', 13], 'apparel & fashion': ['Moda e Vestuário', 12], 'mining & metals': ['Mineração e Metalurgia', 17], 'oil & energy': ['Óleo e Energia', 18], 'utilities': ['Utilities / Energia', 18], 'renewables & environment': ['Energias Renováveis', 14], 'farming': ['Agronegócio', 14], 'agriculture': ['Agronegócio', 14], 'wholesale': ['Atacado / Distribuição', 15], 'management consulting': ['Consultoria', 9], 'legal services': ['Serviços Jurídicos', 9], 'law practice': ['Advocacia', 8], 'marketing & advertising': ['Marketing e Publicidade', 7], 'human resources': ['Recursos Humanos', 8], 'staffing & recruiting': ['Recrutamento', 7], 'education management': ['Gestão Educacional', 12], 'higher education': ['Ensino Superior', 12], 'e-learning': ['Educação Digital', 10], 'government administration': ['Administração Pública', 15], 'nonprofit organization management': ['Terceiro Setor', 6], 'hospitality': ['Hotelaria', 11], 'restaurants': ['Restaurantes', 10], 'leisure, travel & tourism': ['Turismo e Lazer', 10], 'entertainment': ['Entretenimento', 8], 'media production': ['Produção de Mídia', 8], 'publishing': ['Editorial', 7], 'sports': ['Esportes', 7], 'security & investigations': ['Segurança Patrimonial', 13], 'facilities services': ['Facilities', 13], 'outsourcing/offshoring': ['Outsourcing / BPO', 14] };

  const DEPT_PT = { 'Executive': 'Executivo', 'Finance': 'Financeiro', 'Finance Executive': 'Executivo Financeiro', 'Financial Planning & Analysis': 'Planejamento Financeiro', 'Operations': 'Operações', 'Operations Executive': 'Executivo de Operações', 'Business Service Management / ITSM': 'ITSM / Serviços de TI', 'Information Technology': 'Tecnologia da Informação', 'Information Technology Executive': 'Executivo de TI', 'Engineering & Technical': 'Engenharia e Técnico', 'Technology Operations': 'Operações de Tecnologia', 'Marketing': 'Marketing', 'Marketing Executive': 'Executivo de Marketing', 'Human Resources': 'Recursos Humanos', 'Human Resources Executive': 'Executivo de RH', 'Talent Management': 'Gestão de Talentos', 'Founder': 'Fundador', 'Sales': 'Vendas', 'Sales Executive': 'Executivo de Vendas', 'Legal': 'Jurídico', 'Medical & Health': 'Saúde', 'Information Security': 'Segurança da Informação', 'Data Science': 'Ciência de Dados', 'Product Management': 'Produto', 'Consulting': 'Consultoria', 'Accounting': 'Contabilidade', 'Support': 'Suporte', 'Education': 'Educação', 'Administrative': 'Administrativo', 'Real Estate': 'Imobiliário', 'Business Development': 'Desenvolvimento de Negócios' };
  const IT_DEPT = new Set(['Tecnologia da Informação', 'Executivo de TI', 'ITSM / Serviços de TI', 'Operações de Tecnologia', 'Segurança da Informação', 'Engenharia e Técnico']);

  const CID = { 'sao paulo': 'São Paulo', 'sao jose dos campos': 'São José dos Campos', 'sao bernardo do campo': 'São Bernardo do Campo', 'sao caetano do sul': 'São Caetano do Sul', 'santo andre': 'Santo André', 'ribeirao preto': 'Ribeirão Preto', 'sao jose do rio preto': 'São José do Rio Preto', 'sao jose do rio pardo': 'São José do Rio Pardo', 'jacarei': 'Jacareí', 'taubate': 'Taubaté', 'cacapava': 'Caçapava', 'guaratingueta': 'Guaratinguetá', 'tremembe': 'Tremembé', 'sao sebastiao': 'São Sebastião', 'braganca paulista': 'Bragança Paulista', 'itapecerica da serra': 'Itapecerica da Serra', 'maua': 'Mauá', 'embu das artes': 'Embu das Artes', 'sao vicente': 'São Vicente', 'goiania': 'Goiânia', 'brasilia': 'Brasília', 'belem': 'Belém', 'maceio': 'Maceió', 'florianopolis': 'Florianópolis', 'vitoria': 'Vitória', 'sao luis': 'São Luís', 'macae': 'Macaé', 'niteroi': 'Niterói', 'nova iguacu': 'Nova Iguaçu', 'sao goncalo': 'São Gonçalo', 'petropolis': 'Petrópolis', 'teresopolis': 'Teresópolis', 'uberlandia': 'Uberlândia', 'pocos de caldas': 'Poços de Caldas', 'sao jose': 'São José', 'sao leopoldo': 'São Leopoldo', 'sao bento do sul': 'São Bento do Sul', 'itajai': 'Itajaí', 'chapeco': 'Chapecó', 'criciuma': 'Criciúma', 'maringa': 'Maringá', 'foz do iguacu': 'Foz do Iguaçu', 'sao jose dos pinhais': 'São José dos Pinhais', 'jundiai': 'Jundiaí', 'araraquara': 'Araraquara', 'marilia': 'Marília', 'aracatuba': 'Araçatuba', 'santana de parnaiba': 'Santana de Parnaíba', 'cubatao': 'Cubatão', 'joao pessoa': 'João Pessoa', 'teresina': 'Teresina', 'cuiaba': 'Cuiabá', 'vitoria da conquista': 'Vitória da Conquista', 'camacari': 'Camaçari', 'anapolis': 'Anápolis', 'macapa': 'Macapá', 'aracaju': 'Aracaju' };

  /* ---------- classificação de cargo ---------- */
  function classify(title) {
    const pad = ' ' + sa(title).toLowerCase().replace(/[^a-z0-9 &/\-|.()]/g, ' ') + ' ';
    const has = (...ps) => ps.some(p => new RegExp(p).test(pad));
    if (has('assistente', 'assistant to', 'secretari', 'chief of staff', 'executive assistant', 'estagiari', 'intern '))
      return ['Suporte executivo', 'Apoio', 0];
    if (has('\\bceo\\b', 'chief executive', 'presidente', '\\bpresident\\b', 'executivo-chefe', 'diretora? geral', 'diretora?-geral', 'general manager', '\\bgm\\b'))
      return ['CEO / Presidente', 'C-Level', 22];
    if (has('\\bcfo\\b', 'chief financial', 'diretor financeiro', 'diretora financeira', 'financial head', 'head of finance', 'vp finance', 'diretor de financas', 'controller', 'tesourari', '\\bcea\\b'))
      return ['CFO / Financeiro', 'C-Level', 24];
    if (has('\\bciso\\b', 'chief information security', 'seguranca da informacao', 'security officer', 'cyber'))
      return ['CISO / Segurança', 'C-Level', 27];
    if (has('\\bcio\\b', '\\bcto\\b', 'chief information officer', 'chief technology', 'chief technical', 'chief digital', '\\bcdo\\b', 'diretora? de ti\\b', 'diretora? de tecnologia', 'head of it', 'head of technology', 'it director', 'diretora? de informatica', 'diretora? de sistemas', 'vp of engineering', 'vp engineering', 'diretora? de infraestrutura', 'diretora? de ti e', 'diretora? de tecnologia da informacao'))
      return ['CIO / CTO / TI', 'C-Level', 30];
    if (has('\\bcoo\\b', 'chief operating', 'chief operations', 'diretora? de operacoes', 'diretora? operacional', 'head of operations'))
      return ['COO / Operações', 'C-Level', 20];
    if (has('\\bcmo\\b', 'chief marketing', 'diretora? de marketing', 'head of marketing', 'chief revenue', '\\bcro\\b', 'chief commercial', 'diretora? comercial'))
      return ['CMO / Comercial', 'C-Level', 12];
    if (has('\\bchro\\b', 'chief human', 'chief people', 'recursos humanos', 'head of people', 'diretora? de rh', 'diretora? de recursos humanos'))
      return ['CHRO / RH', 'C-Level', 10];
    if (has('founder', 'fundador', 'fundadora', 'socio', 'partner', 'owner', 'proprietari', 'empresari', 'chairman', 'conselho de administracao', 'board member'))
      return ['Fundador / Sócio', 'Fundador', 18];
    if (has('chief ')) return ['Outro C-Level', 'C-Level', 12];
    if (has('diretor', 'director', '\\bvp\\b', 'vice president', 'vice-presidente', '\\bhead\\b', 'superintendente'))
      return ['Diretoria / VP', 'Diretoria', 14];
    if (has('gerente', 'manager', 'coordenador', 'coordinator', 'supervisor'))
      return ['Gerência', 'Gerência', 8];
    return ['Outros', 'Outros', 6];
  }
  const GRUPOS = {"ti":{"p":28,"l":"Tecnologia, software e telecom","k":["tecnologia da informacao e servicos","tecnologia da informacao","software","servicos de computador e software","internet","internet digital","redes de computadores","servicos de informacao","telecomunicacoes","semicondutores","eletronicos de consumo","midia online","seguranca da informacao","seguranca de computadores e redes"]},"fin":{"p":26,"l":"Bancos, seguros e serviços financeiros","k":["servicos financeiros","bancos","seguros","gestao de investimentos","banco de investimento","mercado de capitais","venture capital pe","contabilidade","captacao de recursos"]},"saude":{"p":25,"l":"Saúde, hospitais e farmacêutico","k":["hospitais e saude","saude e hospitais","clinicas medicas","saude bem estar e fitness","saude e bem estar","farmaceutico","dispositivos medicos","biotecnologia","veterinaria","saude mental"]},"varejo":{"p":24,"l":"Varejo, atacado e bens de consumo","k":["varejo","supermercados","atacado","atacado distribuicao","bens de consumo","servicos ao consumidor","comercio internacional","importacao e exportacao","artigos de luxo e joias","artigos esportivos","e commerce"]},"log":{"p":24,"l":"Logística, transporte e armazenagem","k":["logistica e supply chain","transporte rodoviario e ferroviario","transporte e logistica","armazenagem","entregas e fretes","companhias aereas","aviacao","maritimo","maritimo portuario","construcao naval","industria ferroviaria","embalagens"]},"ind":{"p":24,"l":"Indústria e manufatura","k":["maquinas e equipamentos","automotivo","fabricacao eletrica eletronica","eletroeletronico","engenharia mecanica industrial","engenharia industrial","automacao industrial","quimica","quimico","plasticos","papel e celulose","moveis","vidro ceramica e concreto","suprimentos e equipamentos empresariais","graficas","grafica","tabaco","design"]},"energia":{"p":24,"l":"Energia, óleo, gás e mineração","k":["petroleo e energia","oleo e energia","utilities energia agua e gas","utilities energia","energias renovaveis e meio ambiente","energias renovaveis","servicos ambientais","mineracao e metais","mineracao e metalurgia"]},"agro":{"p":20,"l":"Agronegócio e alimentos","k":["agronegocio","alimentos e bebidas","producao de alimentos","laticinios","restaurantes"]},"constr":{"p":18,"l":"Construção e engenharia","k":["construcao","construcao civil","engenharia civil","materiais de construcao","arquitetura e urbanismo","imobiliario","imoveis comerciais"]},"gov":{"p":20,"l":"Setor público e defesa","k":["administracao publica","poder legislativo","politicas publicas","seguranca publica","forcas de seguranca","militar","defesa e espaco","aviacao e aeroespacial","aeroespacial e defesa","gabinete executivo","organizacao politica"]},"edu":{"p":16,"l":"Educação","k":["ensino superior","gestao educacional","educacao basica","e learning","educacao digital","treinamento e coaching","pesquisa"]},"serv":{"p":16,"l":"Serviços corporativos e terceirização","k":["facilities","terceirizacao outsourcing","outsourcing bpo","seguranca e investigacoes","seguranca patrimonial","consultoria de gestao","consultoria","servicos juridicos","advocacia","recursos humanos","recrutamento e selecao","recrutamento"]},"moda":{"p":13,"l":"Moda, têxtil e cosméticos","k":["vestuario e moda","moda e vestuario","textil","cosmeticos"]},"midia":{"p":10,"l":"Mídia, marketing e entretenimento","k":["marketing e publicidade","producao de midia","jornais","editorial","entretenimento","esportes","relacoes publicas e comunicacao","eventos"]},"turismo":{"p":12,"l":"Hotelaria, turismo e lazer","k":["hotelaria","lazer viagens e turismo","turismo e lazer"]},"social":{"p":8,"l":"Terceiro setor e associações","k":["organizacoes sem fins lucrativos","terceiro setor","organizacao civica e social","instituicoes religiosas","servicos individuais e familiares"]}};
  const PTS_POR_CHAVE = (() => {
    const m = {};
    for (const g in GRUPOS) GRUPOS[g].k.forEach(k => { m[k] = GRUPOS[g].p; });
    return m;
  })();
  function canonSec(x) { return sa(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function sectorOf(ind) {
    const bruto = String(ind || '').trim();
    if (!bruto) return ['Não informado', 8];
    const k = bruto.toLowerCase();
    if (SECTOR[k]) return SECTOR[k];
    // rótulo já em português (base reimportada): preserva como veio e
    // busca a aderência pelo grupo macro a que pertence
    return [bruto, PTS_POR_CHAVE[canonSec(bruto)] || 10];
  }
  function porteOf(n) {
    if (n === null) return ['Não informado', 10];
    if (n < 50) return ['Micro (< 50)', 5];
    if (n < 200) return ['Pequena (50–199)', 18];
    if (n < 1000) return ['Média (200–999)', 33];
    if (n < 5000) return ['Grande (1.000–4.999)', 35];
    if (n < 20000) return ['Corporação (5.000–19.999)', 28];
    return ['Mega corporação (20.000+)', 20];
  }
  function ufOf(state) {
    let s = low(state);
    if (!s) return null;
    s = s.replace(/[.;]/g, ' ')
         .replace(/\b(brasil|brazil|br)\b/g, ' ')          // "Sao Paulo, Brazil"
         .replace(/^state of /, '').replace(/^estado (de |do |da )/, '')
         .replace(/ state$/, '').replace(/ province$/, '')
         .trim().replace(/^[,\-/]+|[,\-/]+$/g, '').trim();
    if (UF[s]) return UF[s];
    // "SP - Sao Paulo", "Sao Paulo/SP", "BR-SP", "Sao Paulo (SP)"
    for (const part of s.split(/[,/()\-|]+/).map(x => x.trim()).filter(Boolean)) {
      if (UF[part]) return UF[part];
    }
    const col = s.replace(/\s+/g, ' ');
    return UF[col] || null;
  }
  function empOf(v) {
    const s = String(v || '').replace(/[.,\s]/g, '');
    const m = s.match(/^\d+$/);
    if (m) return +s;
    const r = String(v || '').match(/(\d[\d.,]*)\s*[-–a]\s*(\d[\d.,]*)/);
    if (r) return Math.round((+r[1].replace(/[.,]/g, '') + +r[2].replace(/[.,]/g, '')) / 2);
    return null;
  }

  /* ---------- faturamento anual ---------- */
  const MULT = { k: 1e3, mil: 1e3, m: 1e6, mm: 1e6, mi: 1e6, milhao: 1e6, milhoes: 1e6, million: 1e6,
                 b: 1e9, bi: 1e9, bn: 1e9, bilhao: 1e9, bilhoes: 1e9, billion: 1e9, t: 1e12, tri: 1e12 };
  function revOf(v) {
    let s = sa(v).trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/(r\$|us\$|usd|brl|eur|\$|€|£)/g, ' ').trim();
    // faixas "10m - 50m" ou "10 a 50 milhoes" → ponto médio
    const rg = s.match(/^([\d.,]+)\s*([a-z]*)\s*(?:-|–|a|to|ate)\s*([\d.,]+)\s*([a-z]*)$/);
    if (rg) {
      const b = one(rg[3], rg[4]), a = one(rg[1], rg[2] || rg[4]);
      if (a !== null && b !== null) return Math.round((a + b) / 2);
    }
    const m = s.match(/^([\d.,]+)\s*([a-z]*)/);
    return m ? one(m[1], m[2]) : null;

    function one(num, suf) {
      let t = num.replace(/\s/g, '');
      const hasDot = t.includes('.'), hasCom = t.includes(',');
      if (hasDot && hasCom) t = t.lastIndexOf(',') > t.lastIndexOf('.')
        ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
      else if (hasCom) t = /,\d{3}(\D|$)/.test(t + ' ') && !/,\d{1,2}$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
      else if (hasDot) t = /\.\d{3}(\D|$)/.test(t + ' ') && !/\.\d{1,2}$/.test(t) ? t.replace(/\./g, '') : t;
      const n = parseFloat(t);
      if (!isFinite(n)) return null;
      const k = (suf || '').replace(/[^a-z]/g, '');
      return Math.round(n * (MULT[k] || 1));
    }
  }
  const FAIXAS = [
    [1e6, 'Até 1 mi'], [1e7, '1 – 10 mi'], [5e7, '10 – 50 mi'], [2e8, '50 – 200 mi'],
    [1e9, '200 mi – 1 bi'], [1e10, '1 – 10 bi'], [Infinity, 'Acima de 10 bi'],
  ];
  function faixaOf(n) {
    if (n === null || n === undefined) return 'Não informado';
    for (const [lim, lbl] of FAIXAS) if (n < lim) return lbl;
    return 'Não informado';
  }

  /* ---------- normalização completa ---------- */
  function build(raw, m) {
    const dupe = new Map();
    raw.forEach(r => { const e = low(r[m.email]); if (e) dupe.set(e, (dupe.get(e) || 0) + 1); });

    const out = [];
    raw.forEach((r, idx) => {
      const g = k => (m[k] ? String(r[m[k]] || '').trim() : '');
      const name = m.full ? g('full') : [g('first'), g('last')].filter(Boolean).join(' ');
      const title = g('title'), company = g('company');
      if (!name && !company && !g('email')) return;

      const [fam, sen, pCargo] = classify(title);
      const emp = empOf(g('emp'));
      const [ptLabel, pPorte] = porteOf(emp);
      const [indLabel, pSetor] = sectorOf(g('ind'));
      const email = g('email');
      const dom = email.includes('@') ? email.split('@').pop().toLowerCase() : '';
      const corp = !!dom && !FREE.has(dom);
      const stRaw = g('state'), cityRaw = g('city');
      const uf = ufOf(stRaw);
      const cKey = low(cityRaw);
      const ci = CID[cKey] || cityRaw;
      const br = !!uf;
      let pGeo;
      if (uf === 'SP' && VALE.has(cKey)) pGeo = 10;
      else if (uf === 'SP') pGeo = 9;
      else if (['RJ', 'MG', 'PR', 'SC', 'RS'].includes(uf)) pGeo = 7;
      else if (br) pGeo = 5; else pGeo = 1;
      const li = g('li');
      const pCont = (corp ? 4 : 1) + (li ? 1 : 0);

      const dp = g('dept').split(',').map(x => x.trim()).filter(Boolean).map(x => DEPT_PT[x] || x);
      const ti = dp.some(d => IT_DEPT.has(d)) || fam === 'CIO / CTO / TI' || fam === 'CISO / Segurança';

      let sc = pCargo + pPorte + pSetor + pGeo + pCont + (ti ? 4 : 0);
      sc = Math.max(0, Math.min(100, sc));

      let est, reg;
      if (uf) { est = UF_NOME[uf] + ' (' + uf + ')'; reg = REG[uf]; }
      else if (stRaw || cityRaw) { est = 'Exterior'; reg = 'Exterior'; }
      else { est = 'Não informado'; reg = 'Não informado'; }

      const rev = revOf(g('rev'));

      out.push({
        i: idx, n: name, t: title, c: company, e: email, dom,
        rev, revb: faixaOf(rev),
        f: fam, sen, pt: ptLabel, ind: indLabel, ci, uf: uf || '', est, reg,
        dp, em: emp, li, sc, tr: sc >= 86 ? 'A' : (sc >= 72 ? 'B' : 'C'),
        pc: [pCargo, pPorte, pSetor, pGeo, pCont, ti ? 4 : 0],
        corp, ti, br, dup: !!email && dupe.get(low(email)) > 1,
      });
    });
    out.forEach((r, i) => r.i = i);
    return out;
  }

  /* ---------- reempacota para gerar um novo app ---------- */
  function pack(rows) {
    const dic = (vals) => {
      const c = new Map();
      vals.forEach(v => c.set(v, (c.get(v) || 0) + 1));
      const order = [...c.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
      const ix = new Map(order.map((v, i) => [v, i]));
      return [order, vals.map(v => ix.get(v))];
    };
    const col = k => rows.map(r => r[k]);
    const [fam, famI] = dic(col('f')), [sen, senI] = dic(col('sen')), [porte, ptI] = dic(col('pt'));
    const [ind, indI] = dic(col('ind')), [cid, ciI] = dic(col('ci')), [uf, ufI] = dic(col('uf'));
    const [est, estI] = dic(col('est')), [reg, regI] = dic(col('reg')), [dom, domI] = dic(col('dom'));
    const terms = new Map();
    rows.forEach(r => r.dp.forEach(t => terms.set(t, (terms.get(t) || 0) + 1)));
    const dept = [...terms.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const tix = new Map(dept.map((v, i) => [v, i]));
    const [comboKeys, dpI] = dic(rows.map(r => r.dp.map(t => tix.get(t)).join('|')));
    const LI = 'http://www.linkedin.com/in/';
    return {
      dic: { fam, sen, porte, ind, cid, uf, dom, dept, est, reg, dcombo: comboKeys.map(k => k ? k.split('|').map(Number) : []) },
      cols: {
        n: col('n'), t: col('t'), c: col('c'),
        el: rows.map(r => r.e.includes('@') ? r.e.split('@')[0] : r.e),
        d: domI, f: famI, s: senI, pt: ptI, ind: indI, ci: ciI, uf: ufI, est: estI, reg: regI, dp: dpI,
        em: rows.map(r => r.em === null ? -1 : r.em),
        rev: rows.map(r => r.rev === null || r.rev === undefined ? -1 : r.rev),
        li: rows.map(r => r.li ? (r.li.startsWith(LI) ? r.li.slice(LI.length) : '!' + r.li) : ''),
        sc: col('sc'), pc: col('pc'),
        fl: rows.map(r => (r.corp ? 1 : 0) | (r.ti ? 2 : 0) | (r.br ? 4 : 0) | (r.dup ? 8 : 0)),
      }
    };
  }

  return { readFile, mapCols, build, pack, ALIAS, faixaOf, revOf, FAIXAS, ufOf, GRUPOS, canonSec };
})();
