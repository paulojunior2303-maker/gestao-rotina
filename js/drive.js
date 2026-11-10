'use strict';
/* Sincronização com o Google Drive do usuário (app Android e site).
   Os dados ficam num arquivo na pasta "Gestão de Rotina" do Drive dele (permissão drive.file: o app só enxerga
   o que ele mesmo criou). Regra: vale a versão alterada por último (meta.updatedAt). Sincroniza ao abrir,
   ao voltar para o app e alguns segundos depois de cada alteração.
   Android: GooglePlugin.java (token sem perguntar nada depois da 1ª autorização).
   Site: Google Identity Services (o token dura ~1 h; depois o usuário toca em "Sincronizar"). */
const Drive = {
  WEB_CLIENT_ID: '108519751846-arnrsangld9cs837vk4u7vvp58c2gsdv.apps.googleusercontent.com',
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  FOLDER: 'Gestão de Rotina',
  FILE: 'gestao-rotina-dados.json',
  API: 'https://www.googleapis.com/drive/v3',
  UP: 'https://www.googleapis.com/upload/drive/v3',
  KEY: 'gr-drive',            // dados da conexão NESTE aparelho (não vão no arquivo)
  TOKEN_KEY: 'gr-drive-token',
  state: 'off',               // off | ok | syncing | needs-auth | error
  error: '',
  token: null, tokenExp: 0, busy: false, again: false, timer: null, lastAuto: 0,

  supported() { return !Cloud.available() && (Native.available() || /^https?:/.test(location.protocol)); },
  info() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; } },
  setInfo(o) { try { localStorage.setItem(this.KEY, JSON.stringify({ ...this.info(), ...o })); } catch (e) { /* sem armazenamento */ } },
  connected() { return !!this.info().email; },
  device() { return Native.available() ? 'app Android' : 'navegador'; },
  hasData(st) { return !!st && ['tasks', 'projects', 'occurrences', 'events', 'indicators', 'feedbacks'].some(k => (st[k] || []).length) || !!(st && st.days && Object.keys(st.days).length) || !!(st && st.weekly && st.weekly.focus && st.weekly.focus.length); },

  /* ---------- Token ---------- */
  needsAuth() { const e = new Error('Toque em Sincronizar para reconectar o Google Drive.'); e.needsAuth = true; return e; },
  async getToken(interactive) {
    if (this.token && Date.now() < this.tokenExp - 60000) return this.token;
    if (Native.available()) {
      const G = Native.P().Google;
      if (!G) throw new Error('Atualize o app para usar o Google Drive.');
      try {
        const r = await G.autorizar({ escopos: [this.SCOPE], interativo: !!interactive });
        this.token = r.accessToken; this.tokenExp = Date.now() + 50 * 60000;
        return this.token;
      } catch (e) {
        if (/PRECISA_AUTORIZAR/.test(e.code || e.message)) throw this.needsAuth();
        if (/CANCELADO/.test(e.code || e.message)) throw new Error('Autorização cancelada.');
        throw new Error(e.message || 'Falha na autorização do Google.');
      }
    }
    // Site: token guardado na sessão do navegador (vale ~1 h)
    try { const t = JSON.parse(sessionStorage.getItem(this.TOKEN_KEY)); if (t && Date.now() < t.exp - 60000) { this.token = t.token; this.tokenExp = t.exp; return this.token; } } catch (e) { /* nada guardado */ }
    if (!interactive) throw this.needsAuth();
    await this.loadGIS();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.WEB_CLIENT_ID, scope: this.SCOPE,
        callback: resp => {
          if (resp.error) { reject(new Error(resp.error === 'access_denied' ? 'Autorização negada.' : 'Google: ' + resp.error)); return; }
          this.token = resp.access_token; this.tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
          try { sessionStorage.setItem(this.TOKEN_KEY, JSON.stringify({ token: this.token, exp: this.tokenExp })); } catch (e) { /* ok */ }
          resolve(this.token);
        },
        error_callback: err => reject(new Error(err && err.type === 'popup_closed' ? 'A janela do Google foi fechada.' : 'Não foi possível abrir o login do Google (pop-up bloqueado?).')),
      });
      client.requestAccessToken({ prompt: this.connected() ? '' : 'consent', ...(this.info().email ? { login_hint: this.info().email } : {}) });
    });
  },
  loadGIS() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('Sem conexão com o Google.'));
      document.head.appendChild(s);
    });
  },

  /* ---------- API do Drive ---------- */
  async api(url, opts = {}, retry = true) {
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + this.token } });
    if (r.status === 401 && retry) {
      this.token = null; try { sessionStorage.removeItem(this.TOKEN_KEY); } catch (e) { /* ok */ }
      await this.getToken(false);
      return this.api(url, opts, false);
    }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      const msg = (d.error && d.error.message) || r.status;
      if (r.status === 403 && /has not been used|disabled/i.test(msg)) throw new Error('A Google Drive API não está ativada no projeto do Google Cloud.');
      const e = new Error('Google Drive: ' + msg); e.status = r.status; throw e;
    }
    return r;
  },
  q(s) { return encodeURIComponent(s); },
  async findFolder() {
    const r = await this.api(`${this.API}/files?fields=files(id)&spaces=drive&q=${this.q(`name='${this.FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}`);
    const f = (await r.json()).files[0];
    if (f) return f.id;
    const c = await this.api(`${this.API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: this.FOLDER, mimeType: 'application/vnd.google-apps.folder' }) });
    return (await c.json()).id;
  },
  async findFile(folderId) {
    const r = await this.api(`${this.API}/files?fields=files(id,appProperties)&spaces=drive&q=${this.q(`name='${this.FILE}' and '${folderId}' in parents and trashed=false`)}`);
    return (await r.json()).files[0] || null;
  },
  async ensureIds() {
    let { folderId, fileId } = this.info();
    if (!folderId) { folderId = await this.findFolder(); this.setInfo({ folderId }); }
    if (!fileId) { const f = await this.findFile(folderId); fileId = f ? f.id : null; this.setInfo({ fileId }); }
    return { folderId, fileId };
  },
  async meta(fileId) {
    const r = await this.api(`${this.API}/files/${fileId}?fields=id,trashed,appProperties`);
    return r.json();
  },
  async download(fileId) {
    const r = await this.api(`${this.API}/files/${fileId}?alt=media`);
    const d = await r.json();
    if (!d || !d.state || !Array.isArray(d.state.tasks)) throw new Error('O arquivo do Drive não é um backup válido do app.');
    return d;
  },
  async upload() {
    const { folderId, fileId } = this.info();
    const at = S.meta.updatedAt || Date.now();
    const content = JSON.stringify({ app: 'gestao-rotina', formato: 1, updatedAt: at, device: this.device(), state: S });
    const meta = { name: this.FILE, mimeType: 'application/json', appProperties: { updatedAt: String(at), device: this.device() }, ...(fileId ? {} : { parents: [folderId] }) };
    const b = 'gr' + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${b}--`;
    const url = fileId ? `${this.UP}/files/${fileId}?uploadType=multipart&fields=id` : `${this.UP}/files?uploadType=multipart&fields=id`;
    const r = await this.api(url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
    const d = await r.json();
    this.setInfo({ fileId: d.id, syncedAt: at });
  },
  apply(d) {
    Store.replace(d.state, { fromDrive: true });
    this.setInfo({ syncedAt: d.updatedAt });
    App.render();
  },

  /* ---------- Sincronização ---------- */
  async sync({ interactive = false, quiet = true } = {}) {
    if (!this.supported() || !this.connected()) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true; this.setState('syncing');
    try {
      await this.getToken(interactive);
      let { fileId } = await this.ensureIds();
      if (fileId) {
        const m = await this.meta(fileId).catch(e => { if (e.status === 404) return null; throw e; });
        if (!m || m.trashed) { this.setInfo({ fileId: null }); fileId = null; }
        else {
          const remote = Number((m.appProperties || {}).updatedAt || 0), local = S.meta.updatedAt || 0;
          if (remote > local) { this.apply(await this.download(fileId)); if (!quiet || this.hasData(S)) UI.toast('Dados atualizados pelo Google Drive.'); }
          else if (local > remote) await this.upload();
        }
      }
      if (!fileId) await this.upload();
      this.setInfo({ lastSync: Date.now() });
      this.error = ''; this.setState('ok');
    } catch (e) {
      this.error = e.message;
      this.setState(e.needsAuth ? 'needs-auth' : 'error');
      if (!quiet) UI.toast(U.esc(e.message), 'error');
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.schedule(800); }
    }
  },
  /* Depois de cada alteração local */
  schedule(ms = 2500) {
    if (!this.supported() || !this.connected()) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.sync(), ms);
  },
  /* Ao abrir e ao voltar para o app (no máximo a cada 20 s) */
  auto() {
    if (!this.connected() || Date.now() - this.lastAuto < 20000) return;
    this.lastAuto = Date.now();
    this.sync();
  },
  setState(s) {
    const before = this.state; this.state = s;
    if (typeof App !== 'undefined' && App.renderNav) App.renderNav();
    // Aviso no topo aparece/some: redesenha a tela se mudou entre "precisa reconectar" e os outros estados
    if ((before === 'needs-auth') !== (s === 'needs-auth') && !document.querySelector('.modal-wrap')) App.render();
    const st = document.getElementById('drive-st'); if (st) st.innerHTML = this.statusText();
  },
  statusText() {
    const i = this.info();
    if (this.state === 'syncing') return 'Sincronizando…';
    if (this.state === 'needs-auth') return 'Precisa reconectar (toque em Sincronizar)';
    if (this.state === 'error') return 'Erro: ' + U.esc(this.error);
    return i.lastSync ? `Última sincronização: ${U.fmtDateTime(new Date(i.lastSync).toISOString())}` : 'Ainda não sincronizado';
  },

  /* ---------- Conectar / desconectar ---------- */
  async connect() {
    try {
      this.setInfo({ email: '' });
      await this.getToken(true);
      const about = await (await this.api(`${this.API}/about?fields=user(emailAddress)`)).json();
      const email = (about.user && about.user.emailAddress) || 'conta Google';
      const folderId = await this.findFolder();
      const f = await this.findFile(folderId);
      this.setInfo({ folderId, fileId: f ? f.id : null });
      const done = () => { this.setInfo({ email, lastSync: Date.now() }); this.error = ''; this.setState('ok'); App.render(); UI.toast(`Conectado ao Google Drive (${U.esc(email)}).`); };
      if (!f) { await this.upload(); done(); return; }
      const d = await this.download(f.id);
      if (!this.hasData(S) || d.updatedAt === S.meta.updatedAt) { if (this.hasData(d.state)) this.apply(d); else await this.upload(); done(); return; }
      if (!this.hasData(d.state)) { await this.upload(); done(); return; }
      // Os dois lados têm dados: o usuário escolhe
      const m = UI.modal({
        title: 'Já existem dados no Drive',
        body: `<p>Encontrei dados do app no seu Google Drive, salvos em <strong>${U.fmtDateTime(new Date(d.updatedAt).toISOString())}</strong> (${U.esc(d.device || 'outro aparelho')}). Este ${this.device()} também tem dados.</p>
          <p class="muted small">Escolha qual versão vale daqui para frente. A outra é substituída.</p>`,
        footer: `<button class="btn" data-local>Usar os deste ${this.device()}</button><span class="grow"></span><button class="btn primary" data-remote>Usar os do Drive</button>`,
      });
      m.el.querySelector('[data-remote]').onclick = () => { m.close(); this.apply(d); done(); };
      m.el.querySelector('[data-local]').onclick = async () => { m.close(); S.meta.updatedAt = Date.now(); Store.save({ cloud: true, touch: false }); try { await this.upload(); done(); } catch (e) { UI.toast(U.esc(e.message), 'error'); } };
    } catch (e) {
      this.setInfo({ email: '' });
      UI.toast(U.esc(e.message), 'error');
    }
  },
  disconnect() {
    UI.confirm('Desconectar o Google Drive neste aparelho? Os dados continuam aqui e no Drive, mas param de sincronizar.', () => {
      const t = this.token;
      if (t) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => {});
      this.token = null; this.tokenExp = 0;
      try { localStorage.removeItem(this.KEY); sessionStorage.removeItem(this.TOKEN_KEY); } catch (e) { /* ok */ }
      this.setState('off'); App.render(); UI.toast('Google Drive desconectado.');
    }, { okLabel: 'Desconectar' });
  },

  /* Configurações → Google Drive */
  section(sec) {
    if (!this.supported()) return sec('drive', 'Google Drive', '', '<p class="muted small">A sincronização pelo Google Drive funciona no app Android e no site. No link do Claude, os dados ficam salvos na sua conta Claude.</p>');
    const i = this.info();
    return sec('drive', 'Google Drive (sincronização)', 'Seus dados ficam no seu Google Drive e iguais no celular e no computador.', i.email ? `
      <div class="lem-row ok">${U.icon('check', 16)}<span>Conectado como <strong>${U.esc(i.email)}</strong><br><small id="drive-st" class="muted">${this.statusText()}</small></span></div>
      <div class="row-actions wrap"><button class="btn sm primary" data-act="driveSync">${U.icon('undo', 15)} Sincronizar agora</button><button class="btn sm ghost danger-text" data-act="driveOff">Desconectar</button></div>
      <p class="muted small mt">O arquivo fica na pasta <strong>${this.FOLDER}</strong> do seu Drive. Vale sempre a alteração mais recente: evite editar no celular e no computador ao mesmo tempo.${Native.available() ? '' : ' Neste navegador, a conexão com o Google dura cerca de 1 hora; depois disso, toque em Sincronizar.'}</p>` : `
      <p class="small">Conecte a sua conta Google para:</p>
      <ul class="steps small"><li>ter os mesmos dados no app e no site, sem precisar enviar códigos;</li><li>ter uma cópia de segurança automática no seu Drive.</li></ul>
      <div class="row-actions"><button class="btn primary" data-act="driveConnect">${U.icon('user', 15)} Conectar com o Google</button></div>
      <p class="muted small mt">O app só enxerga a pasta “${this.FOLDER}” que ele mesmo cria no seu Drive. Seus outros arquivos continuam privados.</p>`);
  },
  banner() {
    if (this.state !== 'needs-auth' || !this.connected()) return '';
    return `<div class="alert a-accent drive-banner">${U.icon('undo')}<span>Reconecte o Google Drive para continuar sincronizando os dados.</span><button class="btn sm primary" data-act="driveSync">Sincronizar</button></div>`;
  },
};

Object.assign(Actions, {
  driveConnect() { Drive.connect(); },
  driveSync() { Drive.sync({ interactive: true, quiet: false }).then(() => { if (Drive.state === 'ok') UI.toast('Sincronizado com o Google Drive.'); }); },
  driveOff() { Drive.disconnect(); },
});
