'use strict';
/* Integração com o app Android (Capacitor). Inativo no navegador e no claude.ai. */
const Native = {
  FILE: 'gestao-rotina-dados.json',
  timer: null,

  available() { return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()); },
  P() { return window.Capacitor.Plugins; },

  /* Antes de carregar: se o LocalStorage estiver vazio (ex.: limpeza de dados da WebView),
     recupera a cópia guardada na área interna do app. */
  async restore() {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
      const r = await this.P().Filesystem.readFile({ path: this.FILE, directory: 'DATA', encoding: 'utf8' });
      if (r && r.data) { JSON.parse(r.data); localStorage.setItem(STORAGE_KEY, r.data); }
    } catch (e) { /* primeira execução: nada a recuperar */ }
  },

  /* Cópia de segurança do estado em arquivo interno (além do LocalStorage) */
  persist() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.P().Filesystem.writeFile({ path: this.FILE, directory: 'DATA', encoding: 'utf8', data: JSON.stringify(S) }).catch(() => {});
    }, 800);
  },

  init() {
    const { App: CapApp } = this.P();
    if (!CapApp) return;
    // Botão "voltar": fecha janela/menu, depois volta ao Início e só então sai do app
    CapApp.addListener('backButton', () => {
      if (document.querySelector('.modal-wrap')) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return; }
      if (document.body.classList.contains('menu-open')) { App.closeMenu(); return; }
      if (App.route !== 'dashboard') { location.replace('#dashboard'); return; }
      CapApp.exitApp();
    });
    // Ao voltar ao app, atualiza horários e atrasos
    CapApp.addListener('resume', () => { if (!document.querySelector('.modal-wrap')) App.render(); Reminders.schedule(); Drive.auto(); });
  },

  blobToBase64(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
  },

  /* Arquivos (Excel, backup): grava no cache e abre o menu de compartilhamento do Android
     (Salvar no Drive, Arquivos, WhatsApp, e-mail…) */
  async save(filename, blob) {
    try {
      const { Filesystem, Share } = this.P();
      const data = await this.blobToBase64(blob);
      const r = await Filesystem.writeFile({ path: filename, data, directory: 'CACHE' });
      await Share.share({ title: filename, files: [r.uri], dialogTitle: 'Salvar ou enviar arquivo' });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) UI.toast('Não foi possível compartilhar o arquivo: ' + U.esc(e && e.message), 'error');
    }
  },

  async print(html, name) {
    try { await this.P().Printer.print({ html, name }); }
    catch (e) { UI.toast('Não foi possível abrir a impressão: ' + U.esc(e && e.message), 'error'); }
  },
};
