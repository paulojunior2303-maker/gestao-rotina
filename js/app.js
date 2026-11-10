'use strict';
/* Inicialização, navegação e delegação de eventos */
/* Menu lateral em grupos. "Projetos" e "Indicadores" só aparecem se ativados em Configurações → Aparência.
   Feedbacks fica dentro de Reuniões (aba Feedbacks). */
const NAV_GROUPS = [
  ['Dia a dia', ['dashboard', 'agenda', 'tarefas', 'reunioes', 'imprevistos']],
  ['Planejamento', ['projetos', 'indicadores']],
  ['Ajustes', ['config', 'guia']],
];
/* Barra inferior (celular): atalhos do dia a dia. O menu completo fica no ☰ (sem botão Menu na barra). */
const BOTTOM = ['dashboard', 'agenda', 'tarefas', 'imprevistos'];
const routeVisible = id => {
  const st = (S && S.settings) || {};
  return id === 'indicadores' ? !!st.showIndicadores : id === 'projetos' ? !!st.showProjetos : true;
};
/* Botão flutuante "+": o que ele cria depende da tela */
const FAB = {
  act(route) { const v = Views[route]; return v && v.fab ? (typeof v.fab === 'function' ? v.fab() : v.fab) : null; },
  render(route) {
    const el = document.getElementById('fab'); if (!el) return;
    const f = this.act(route);
    el.hidden = !f;
    if (f) { el.dataset.act = f.act; el.setAttribute('aria-label', f.label); el.title = f.label; Object.keys(el.dataset).filter(k => k !== 'act').forEach(k => delete el.dataset[k]); Object.assign(el.dataset, f.data || {}); }
  },
};

const App = {
  ui: {},
  route: 'dashboard',
  params: {},

  parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    // Planejamento semanal e mensal agora ficam dentro da Agenda (links antigos continuam funcionando)
    if (path === 'semanal' || path === 'mensal') { this.route = 'agenda'; this.params = {}; return; }
    if (path === 'feedbacks') { this.ui.mtTab = 'feedbacks'; this.route = 'reunioes'; this.params = {}; return; }
    this.route = Views[path] && routeVisible(path) ? path : 'dashboard';
    this.params = Object.fromEntries(new URLSearchParams(qs || ''));
  },

  renderNav() {
    const occOpen = S.occurrences.filter(o => OPEN(o.status)).length;
    const late = S.tasks.filter(D.taskLate).length;
    const badge = id => id === 'imprevistos' && occOpen ? `<span class="nav-badge">${occOpen}</span>` : id === 'tarefas' && late ? `<span class="nav-badge">${late}</span>` : '';
    document.getElementById('nav').innerHTML = NAV_GROUPS.map(([g, ids]) => [g, ids.filter(routeVisible)]).filter(([, ids]) => ids.length).map(([g, ids]) => `<div class="nav-group"><span class="nav-g">${g}</span>${ids.map(id => `<a href="#${id}" class="${this.route === id ? 'active' : ''}"${this.route === id ? ' aria-current="page"' : ''}>${U.icon(Views[id].icon)}<span>${Views[id].nav}</span>${badge(id)}</a>`).join('')}</div>`).join('');
    const dv = typeof Drive !== 'undefined' && Drive.connected() ? Drive.state : '';
    document.getElementById('menu-btn').classList.toggle('has-badge', occOpen + late > 0);
    document.getElementById('bottom-nav').innerHTML = BOTTOM.map(id => `<a href="#${id}" class="${this.route === id ? 'active' : ''}"${this.route === id ? ' aria-current="page"' : ''}><span class="bn-ic">${U.icon(Views[id].icon, 20)}</span><span>${Views[id].bnav || Views[id].nav}</span>${badge(id)}</a>`).join('');
    FAB.render(this.route);
    document.getElementById('storage-status').innerHTML =
      dv === 'ok' ? '<span class="dot-ok"></span> Sincronizado com o Google Drive'
      : dv === 'syncing' ? '<span class="dot-wait"></span> Sincronizando com o Google Drive…'
      : dv === 'needs-auth' ? '<span class="dot-wait"></span> Google Drive: toque em Sincronizar'
      : dv === 'error' ? '<span class="dot-err"></span> Google Drive: erro ao sincronizar'
      : Cloud.state === 'on' ? '<span class="dot-ok"></span> Dados salvos na sua conta (privados)'
      : Cloud.state === 'connecting' ? '<span class="dot-wait"></span> Conectando…'
      : Store.persistent ? `<span class="dot-ok"></span> Dados salvos neste ${Native.available() ? 'aparelho' : 'navegador'}`
      : '<span class="dot-err"></span> Armazenamento indisponível — os dados serão perdidos ao fechar';
  },

  render(opts = {}) {
    Theme.apply();
    const view = Views[this.route];
    const root = document.getElementById('view');
    let focus = null;
    if (opts.keepFocus && document.activeElement && document.activeElement.dataset.input) {
      focus = { sel: `[data-input="${document.activeElement.dataset.input}"]`, pos: document.activeElement.selectionStart };
    }
    const scroll = window.scrollY;
    document.getElementById('page-title').textContent = view.title;
    if (opts.resetScroll) { root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter'); }
    document.title = `${view.title} · Gestão de Rotina${CANAL_TESTE ? ' (TESTE)' : ''}`;
    const demo = Store.hasDemo() ? `<div class="alert a-yellow demo-banner">${U.icon('info')} <span>Há <strong>dados de demonstração</strong> carregados (marcados como EXEMPLO). Eles não representam sua operação.</span> <button class="btn sm ghost" data-act="demoRemove">Remover</button></div>` : '';
    const warn = Cloud.state === 'error' ? `<div class="alert a-red">${U.icon('alert')} <span>Não foi possível conectar à sua conta para salvar os dados. ${Store.persistent ? 'Por enquanto eles ficam só neste navegador.' : 'As alterações não serão preservadas.'} Recarregue a página para tentar de novo.</span></div>`
      : Store.isPersistent() ? '' : `<div class="alert a-red">${U.icon('alert')} <span>Não há onde salvar os dados nesta visualização. ${Cloud.available() ? 'Entre na sua conta Claude para que os dados fiquem salvos.' : 'Abra o aplicativo em um navegador comum (Chrome, Edge, Firefox, Safari).'} Use Configurações → Exportar backup para não perder informações.</span></div>`;
    try {
      root.innerHTML = warn + Drive.banner() + demo + view.render(this.params);
      if (view.mount) view.mount(root);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="alert a-red">${U.icon('alert')} Erro ao exibir esta tela: ${U.esc(e.message)}</div>`;
    }
    this.renderNav();
    if (opts.resetScroll) window.scrollTo(0, 0); else window.scrollTo(0, scroll);
    if (focus) { const el = root.querySelector(focus.sel); if (el) { el.focus(); try { el.setSelectionRange(focus.pos, focus.pos); } catch (e) { /* tipo sem seleção */ } } }
  },

  async init() {
    if (CANAL_TESTE) {   // marca visível: é a versão de teste
      document.body.classList.add('canal-teste');
      document.querySelector('.topbar').insertAdjacentHTML('afterbegin', '<span class="teste-tag" title="Versão de teste: dados separados do app oficial">TESTE</span>');
    }
    if (Native.available()) { await Native.restore(); Native.init(); document.body.classList.add('native'); }
    Store.load();
    Theme.init();
    if (Cloud.available()) {
      document.getElementById('view').innerHTML = '<div class="loading"><span class="spinner"></span> Carregando seus dados…</div>';
      this.renderNav();
      await Cloud.init();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Cloud.pull(); });
    }
    this.parseHash();
    window.addEventListener('hashchange', () => { this.parseHash(); this.closeMenu(); this.render({ resetScroll: true }); });

    // Delegação de eventos: data-act (clique), data-change, data-input, data-submit
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = Actions[el.dataset.act];
      if (fn) { e.preventDefault(); fn({ ...el.dataset }, el, e); }
    });
    document.addEventListener('change', e => {
      const el = e.target.closest('[data-change]');
      if (el && Actions[el.dataset.change]) Actions[el.dataset.change]({ ...el.dataset }, el, e);
    });
    let inputTimer;
    document.addEventListener('input', e => {
      const el = e.target.closest('[data-input]');
      if (!el || !Actions[el.dataset.input]) return;
      clearTimeout(inputTimer); inputTimer = setTimeout(() => Actions[el.dataset.input]({ ...el.dataset }, el, e), 250);
    });
    document.addEventListener('submit', e => {
      const f = e.target.closest('[data-submit]');
      if (!f) return;
      e.preventDefault();
      if (Actions[f.dataset.submit]) Actions[f.dataset.submit]({ ...f.dataset }, f, e);
    });

    document.getElementById('menu-btn').addEventListener('click', () => this.openMenu());
    document.getElementById('backdrop').addEventListener('click', () => this.closeMenu());
    // Celular: arrastar da borda esquerda abre o menu; arrastar para a esquerda fecha
    let sx = null, sy = 0;
    document.addEventListener('touchstart', e => { const t = e.touches[0]; sx = (t.clientX < 24 || document.body.classList.contains('menu-open')) && !document.querySelector('.modal-wrap') ? t.clientX : null; sy = t.clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (sx === null) return;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy); sx = null;
      if (dy > 60) return;
      if (dx > 60 && !document.body.classList.contains('menu-open')) this.openMenu();
      else if (dx < -60 && document.body.classList.contains('menu-open')) this.closeMenu();
    }, { passive: true });

    // Relógio e atualização periódica (status "agora"/"atrasada")
    const tick = () => {
      const now = new Date();
      const s = now.toLocaleTimeString('pt-BR');
      const c = document.getElementById('dash-clock'); if (c) c.textContent = s;
      document.getElementById('top-clock').textContent = `${U.WD_SHORT[now.getDay()]}, ${U.fmtShort(U.today())} · ${s.slice(0, 5)}`;
    };
    tick(); setInterval(tick, 1000);
    let lastMin = U.nowMin(), lastDay = U.today();
    setInterval(() => {
      const m = U.nowMin();
      if (m === lastMin) return;
      lastMin = m;
      const busy = document.querySelector('.modal-wrap') || (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName));
      if (!busy && ['dashboard', 'agenda'].includes(this.route)) this.render();
      if (U.today() !== lastDay) { lastDay = U.today(); if (!busy) this.render(); }
    }, 5000);

    document.body.classList.add('intro');
    this.render();
    setTimeout(() => document.body.classList.remove('intro'), 1600);
    Tutorial.maybeShow();
    if (Native.available()) { Reminders.initNative(); Updater.check(); } else Reminders.webLoop();
    Drive.auto();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Drive.auto(); });
    if (!CANAL_TESTE && 'serviceWorker' in navigator && location.protocol.startsWith('http') && !Cloud.available() && !Native.available()) navigator.serviceWorker.register('sw.js').catch(() => {});
  },
  go(route) { if (this.route === route) this.render({ resetScroll: true }); else location.hash = '#' + route; },
  openMenu() { document.body.classList.add('menu-open'); },
  closeMenu() { document.body.classList.remove('menu-open'); },
};

/* Tema claro/escuro (Configurações → Aparência) */
const Theme = {
  mq: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null,
  current() {
    const t = (S && S.settings && S.settings.theme) || 'escuro';
    return t === 'escuro' || (t === 'auto' && this.mq && this.mq.matches) ? 'dark' : 'light';
  },
  apply() {
    const t = this.current();
    if (document.documentElement.dataset.theme !== t) document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0e0c13' : '#f5f3f9');
  },
  init() {
    this.apply();
    if (this.mq) {
      const onChange = () => { if (S.settings.theme === 'auto') this.apply(); };
      if (this.mq.addEventListener) this.mq.addEventListener('change', onChange); else if (this.mq.addListener) this.mq.addListener(onChange);
    }
  },
};

/* Salva e redesenha a tela atual */
function commit() { Store.save(); App.render(); }

Actions.openMenu = () => App.openMenu();
Actions.goAgenda = ({ d }) => { App.ui.agendaDate = d; App.go('agenda'); };
Actions.goTasks = ({ status }) => { App.ui.taskF = { q: '', status, priority: '', category: '', period: '', from: '', to: '' }; App.go('tarefas'); };

document.addEventListener('DOMContentLoaded', () => App.init());
