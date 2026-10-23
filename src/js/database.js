/* Backend opcional. Token somente em memória; contatos nunca são gravados em storage do navegador. */
const DB = (() => {
  let token = '', api = '', user = null, nextOffset = null, busyImport = false, libraryBusy = false;
  const el = id => document.getElementById(id);
  const message = value => { el('dbMessage').textContent = value; };
  const connected = () => !!token;
  function update() {
    el('dbLogin').hidden = connected();
    el('dbLibrary').hidden = !connected();
    el('dbUser').textContent = user ? `Conectado como ${user.name}` : '';
    el('btnBases').textContent = connected() ? 'Bases salvas' : 'Conectar banco';
    el('importMode').hidden = connected();
    el('importDestination').textContent = connected()
      ? 'A carga será salva como uma nova base no banco. Depois de salvar, escolha se deseja usá-la no painel.'
      : 'Modo local: os contatos ficam nesta sessão. Conecte o banco para preservar e consultar suas bases depois.';
  }
  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(api + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000), credentials: 'omit' }); }
    catch { throw new Error('Não foi possível acessar o backend. Confira o endereço, o HTTPS e a conexão.'); }
    const data = response.status === 204 ? {} : await response.json();
    if (response.status === 401 && auth) { token = ''; user = null; clearSavedBase(); update(); }
    if (!response.ok) throw new Error(data.error || 'Falha na consulta ao banco.');
    return data;
  }
  function setLibraryBusy(value) {
    libraryBusy = value;
    el('dbLibrary').querySelectorAll('button').forEach(button => { button.disabled = value; });
    el('dbItems').setAttribute('aria-busy', String(value));
    el('dbRefresh').textContent = value ? 'Atualizando…' : 'Atualizar lista';
  }
  async function refreshList(append = false) {
      const data = await request('/v1/imports' + (append ? `?offset=${nextOffset}` : ''));
      if (!append) el('dbItems').replaceChildren();
      for (const item of data.items) {
        const card = document.createElement('article'); card.className = 'db-card';
        const title = document.createElement('strong'); title.textContent = item.description;
        const detail = document.createElement('p');
        const date = new Date(item.imported_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        detail.textContent = `${item.record_count.toLocaleString('pt-BR')} contatos · ${date} (Brasília) · ${item.imported_by} · ${item.filename}`;
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Usar esta base';
        button.onclick = async () => { button.disabled = true; try { await activate(item.id); } finally { button.disabled = false; } };
        const actions = document.createElement('div'); actions.className = 'db-actions'; actions.append(button);
        if (item.imported_by_id === user?.id && user?.id) {
          const remove = document.createElement('button'); remove.className = 'btn db-danger'; remove.textContent = 'Excluir base';
          const confirmation = document.createElement('section'); confirmation.className = 'db-delete-confirm'; confirmation.hidden = true;
          const warning = document.createElement('p'); warning.textContent = `Excluir permanentemente a base “${item.description}” e seus ${item.record_count.toLocaleString('pt-BR')} contatos do banco? As outras bases continuarão salvas.`;
          const confirm = document.createElement('button'); confirm.className = 'btn db-danger'; confirm.textContent = 'Confirmar exclusão';
          const cancel = document.createElement('button'); cancel.className = 'btn'; cancel.textContent = 'Cancelar';
          remove.onclick = () => { confirmation.hidden = false; remove.hidden = true; cancel.focus(); };
          cancel.onclick = () => { confirmation.hidden = true; remove.hidden = false; remove.focus(); };
          confirm.onclick = () => removeSaved(item, card);
          confirmation.append(warning, confirm, cancel); actions.append(remove); card.append(title, detail, actions, confirmation);
        } else card.append(title, detail, actions);
        el('dbItems').append(card);
      }
      nextOffset = data.next_offset; el('dbMore').hidden = nextOffset === null;
      const total = el('dbItems').children.length;
      const when = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const outdated = total && (!user?.id || data.items.some(item => !item.imported_by_id));
      const notice = `Lista atualizada às ${when} (Brasília). ${total ? `${total} base(s) exibida(s). Escolha qual carregar no painel.` : 'Nenhuma base salva. Importe uma planilha para começar.'}${outdated ? ' Para habilitar Excluir base, conclua a atualização da API na VPS e entre novamente.' : ''}`;
      message(notice); return notice;
  }
  async function list(append = false) {
    if (libraryBusy) return;
    setLibraryBusy(true); message('Consultando bases salvas…');
    try { await refreshList(append); }
    catch (error) { message(error.message); }
    finally { setLibraryBusy(false); }
  }
  async function removeSaved(item, card) {
    if (libraryBusy) return;
    if (busyImport) { message('Aguarde a importação em andamento antes de excluir uma base.'); return; }
    setLibraryBusy(true); message('Excluindo a base selecionada…');
    try {
      await request(`/v1/imports/${encodeURIComponent(item.id)}`, { method: 'DELETE', body: { confirmation_description: item.description } });
      if (SOURCE?.id === item.id) clearSavedBase();
      card.remove(); toast('Base excluída do banco.');
      try { const notice = await refreshList(); message(`Base “${item.description}” excluída. ${notice}`); }
      catch (error) { message(`Exclusão confirmada. Não foi possível atualizar a lista: ${error.message}`); }
    } catch (error) {
      message(/^Não foi possível acessar/.test(error.message) ? 'Não foi possível confirmar a exclusão. Use Atualizar lista para conferir antes de tentar novamente.' : error.message);
    } finally { setLibraryBusy(false); }
  }
  function open() {
    el('bases').classList.add('on'); el('bases').setAttribute('aria-hidden', 'false'); update();
    if (connected()) list(); else el('dbApi').focus();
  }
  function close() { el('bases').classList.remove('on'); el('bases').setAttribute('aria-hidden', 'true'); }
  async function activate(id) {
    if (libraryBusy) return;
    setLibraryBusy(true);
    try {
      message('Carregando contatos…');
      const { item } = await request(`/v1/imports/${encodeURIComponent(id)}`);
      activateSavedBase(item);
      close(); closeUpl(); toast(`Base carregada: ${item.description}`);
    } catch (error) { message(error.message); toast(error.message); }
    finally { setLibraryBusy(false); }
  }
  async function save(file, rows, description) {
    const bytes = await file.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    const body = { request_id: crypto.randomUUID(), description, filename: file.name, source_sha256: hash, pack: ING.pack(rows) };
    try { return (await request('/v1/imports', { method: 'POST', body })).item; }
    catch (error) {
      if (!connected() || !/Não foi possível acessar/.test(error.message)) throw error;
      return (await request('/v1/imports', { method: 'POST', body })).item;
    }
  }
  function init(defaultApi = '') {
    el('dbApi').value = defaultApi;
    el('btnBases').onclick = open; el('basesClose').onclick = close;
    el('bases').onclick = e => { if (e.target.id === 'bases') close(); };
    el('dbMore').onclick = () => list(true);
    el('dbRefresh').onclick = () => list();
    el('dbNew').onclick = () => { close(); openUpl(); };
    el('dbLogout').onclick = async () => {
      let notice = 'Sessão encerrada.';
      try { await request('/v1/sessions/current', { method: 'DELETE' }); }
      catch { notice = 'Acesso removido desta aba. Não foi possível confirmar a revogação no servidor; a sessão remota vencerá no prazo de oito horas.'; }
      token = ''; user = null; clearSavedBase(); update(); message(notice);
    };
    el('dbLogin').onsubmit = async e => {
      e.preventDefault(); const button = el('dbConnect'); button.disabled = true;
      try {
        const url = new URL(el('dbApi').value);
        if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Use HTTPS; HTTP é permitido somente no desenvolvimento local.');
        if (url.pathname !== '/') throw new Error('Informe apenas a origem da API, sem caminho.');
        api = url.origin; message('Conectando…');
        const data = await request('/v1/sessions', { method: 'POST', auth: false, body: { login: el('dbUsername').value.trim(), password: el('dbPassword').value } });
        token = data.token; user = data.user; el('dbPassword').value = ''; update(); await list();
      } catch (error) { message(error.message); }
      finally { button.disabled = false; }
    };
    update();
  }
  return { init, open, connected, save, activate, get busy() { return busyImport; }, set busy(value) { busyImport = value; } };
})();
