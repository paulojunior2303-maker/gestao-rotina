'use strict';
/* Componentes de interface: modal, formulário, confirmação, toast, chips */
const UI = (() => {
  const root = () => document.getElementById('modal-root');
  const stack = [];

  function modal({ title, body = '', footer = '', wide = false, onMount, onClose, canClose }) {
    const el = document.createElement('div');
    el.className = 'modal-wrap';
    el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
      <div class="modal-head"><h2>${U.esc(title)}</h2><button class="icon-btn" data-close aria-label="Fechar">${U.icon('x')}</button></div>
      <div class="modal-body"></div>
      <div class="modal-foot"></div></div>`;
    const api = {
      el,
      setBody(html) { el.querySelector('.modal-body').innerHTML = html; },
      setFooter(html) { const f = el.querySelector('.modal-foot'); f.innerHTML = html; f.style.display = html ? '' : 'none'; },
      /* Fechamento pedido pelo usuário (fora, X, Esc, voltar, Cancelar): pode ser barrado */
      tryClose() { if (canClose && !canClose()) return; api.close(); },
      close() {
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        el.classList.remove('open'); setTimeout(() => el.remove(), 150);
        if (onClose) onClose();
      },
    };
    api.setBody(body); api.setFooter(footer);
    el.addEventListener('mousedown', e => { if (e.target === el) api.tryClose(); });
    el.querySelector('[data-close]').addEventListener('click', () => api.tryClose());
    root().appendChild(el);
    stack.push(api);
    requestAnimationFrame(() => el.classList.add('open'));
    if (onMount) onMount(api);
    const first = el.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
    if (first && window.matchMedia('(min-width: 900px)').matches) setTimeout(() => first.focus(), 60);
    return api;
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].tryClose(); });

  function opts(options, value) {
    return options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o.value, o.label];
      return `<option value="${U.esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${U.esc(l)}</option>`;
    }).join('');
  }

  function fieldHtml(f) {
    const id = 'f_' + f.name;
    const req = f.required ? 'required' : '';
    const full = f.half ? '' : 'full';
    const hint = f.hint ? `<small class="hint">${f.hint}</small>` : '';
    const v = f.value ?? '';
    const si = f.showIf ? `data-showif="${f.showIf}"` : '';
    let input;
    switch (f.type) {
      case 'html': return `<div class="field ${full}">${f.html}</div>`;
      case 'textarea': input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} placeholder="${U.esc(f.placeholder || '')}">${U.esc(v)}</textarea>`; break;
      case 'select': input = `<select id="${id}" name="${f.name}" ${req}>${opts(f.options, v)}</select>`; break;
      case 'checkbox': return `<div class="field ${full}" ${si}><label class="check"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> <span>${f.label}</span></label>${hint}</div>`;
      case 'radio': return `<div class="field ${full}" ${si}><span class="lbl">${f.label}</span>${f.options.map(([ov, ol]) => `<label class="check radio"><input type="radio" name="${f.name}" value="${U.esc(ov)}" ${ov === v ? 'checked' : ''}> <span>${ol}</span></label>`).join('')}${hint}</div>`;
      case 'weekdays': return `<div class="field ${full}" ${si}><span class="lbl">${f.label}</span><div class="wd-pick">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="${f.name}" value="${d}" ${(v || []).includes(d) ? 'checked' : ''}><span>${U.WD_SHORT[d]}</span></label>`).join('')}</div>${hint}</div>`;
      default: input = `<input id="${id}" type="${f.type || 'text'}" name="${f.name}" value="${U.esc(v)}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} placeholder="${U.esc(f.placeholder || '')}" ${f.list ? `list="dl_${f.name}" autocomplete="off"` : ''}>${f.list ? `<datalist id="dl_${f.name}">${f.list.map(x => `<option value="${U.esc(x)}">`).join('')}</datalist>` : ''}`;
    }
    return `<div class="field ${full}" ${si}><label for="${id}">${f.label}${f.required ? ' <em>*</em>' : ''}</label>${input}${hint}</div>`;
  }

  function readForm(form, fields) {
    const out = {};
    for (const f of fields) {
      if (!f.name || f.type === 'html') continue;
      if (f.type === 'checkbox') out[f.name] = form.elements[f.name].checked;
      else if (f.type === 'weekdays') out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map(i => Number(i.value));
      else if (f.type === 'radio') { const c = form.querySelector(`input[name="${f.name}"]:checked`); out[f.name] = c ? c.value : null; }
      else if (f.type === 'number') { const raw = form.elements[f.name].value.trim(); out[f.name] = raw === '' ? null : Number(raw); }
      else out[f.name] = form.elements[f.name].value.trim();
    }
    return out;
  }

  /* Formulário genérico. onSubmit(values) pode retornar uma string de erro para manter o modal aberto. */
  function form({ title, fields, submitLabel = 'Salvar', onSubmit, validate, wide, extra = [], onChange, onClose, canClose }) {
    const m = modal({
      title, wide, onClose, canClose,
      body: `<form class="form-grid" novalidate>${fields.map(fieldHtml).join('')}<div class="form-error full" hidden></div><button type="submit" hidden></button></form>`,
      footer: `${extra.map((b, i) => `<button type="button" class="btn ${b.cls || 'ghost'}" data-extra="${i}">${b.label}</button>`).join('')}<span class="grow"></span><button type="button" class="btn ghost" data-cancel>Cancelar</button><button type="button" class="btn primary" data-submit>${submitLabel}</button>`,
    });
    const f = m.el.querySelector('form');
    const err = m.el.querySelector('.form-error');
    const applyShowIf = () => {
      m.el.querySelectorAll('[data-showif]').forEach(el => {
        const [name, val] = el.dataset.showif.split('=');
        const vals = readForm(f, fields);
        el.style.display = String(vals[name]) === val ? '' : 'none';
      });
    };
    applyShowIf();
    f.addEventListener('change', () => { applyShowIf(); if (onChange) onChange(readForm(f, fields), f); });
    const submit = () => {
      err.hidden = true;
      if (!f.checkValidity()) { f.reportValidity(); return; }
      const vals = readForm(f, fields);
      const msg = (validate && validate(vals)) || onSubmit(vals, m);
      if (typeof msg === 'string') { err.textContent = msg; err.hidden = false; return; }
      m.close();
    };
    f.addEventListener('submit', e => { e.preventDefault(); submit(); });
    m.el.querySelector('[data-submit]').addEventListener('click', submit);
    m.el.querySelector('[data-cancel]').addEventListener('click', () => m.tryClose());
    m.el.querySelectorAll('[data-extra]').forEach(b => b.addEventListener('click', () => extra[Number(b.dataset.extra)].onClick(readForm(f, fields), m)));
    return m;
  }

  function confirm(message, onYes, { okLabel = 'Confirmar', danger = false, title = 'Confirmação' } = {}) {
    const m = modal({
      title, body: `<p class="confirm-msg">${message}</p>`,
      footer: `<span class="grow"></span><button class="btn ghost" data-no>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${okLabel}</button>`,
    });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = () => { m.close(); onYes(); };
  }

  /* Lista de ações (menu "mais opções") — funciona bem no celular e no computador */
  function sheet(title, actions) {
    const m = modal({
      title,
      body: `<div class="sheet">${actions.map((a, i) => a.sep ? '<hr>' : `<button class="sheet-item ${a.danger ? 'danger' : ''}" data-i="${i}">${a.icon ? U.icon(a.icon) : ''}<span>${a.label}${a.hint ? `<small>${a.hint}</small>` : ''}</span></button>`).join('')}</div>`,
    });
    m.setFooter('');
    m.el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { m.close(); actions[Number(b.dataset.i)].onClick(); });
  }

  function toast(msg, type = 'ok', action) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>${action ? `<button class="link">${action.label}</button>` : ''}`;
    if (action) el.querySelector('button').onclick = () => { action.onClick(); el.remove(); };
    const rootEl = document.getElementById('toast-root');
    while (rootEl.children.length >= 2) rootEl.firstChild.remove();   // no máximo 2 avisos na tela
    rootEl.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, action ? 6000 : 3200);
  }

  /* --- Pequenos componentes HTML --- */
  const chip = (label, color, extra = '') => `<span class="chip ${extra}" style="--c:${color}">${U.esc(label)}</span>`;
  const H = {
    chip,
    cat: id => { const c = D.cat(id); return chip(c.name, c.color); },
    prio: p => { const x = D.prio(p); return chip(x.label, x.color, 'prio-' + p); },
    status: s => { const x = D.status(s); return chip(x.label, x.color, 'dot'); },
    pstatus: s => { const x = PROJECT_STATUS[s] || PROJECT_STATUS.planejamento; return chip(x.label, x.color, 'dot'); },
    deadline: info => info ? `<span class="dl dl-${info.level}">${U.icon(info.level === 'late' ? 'alert' : 'clock', 13)} ${U.esc(info.label)}</span>` : '',
    bar: (pct, color, cls = '') => `<div class="bar ${cls}"><span style="width:${pct ?? 0}%;${color ? `background:${color}` : ''}"></span></div>`,
    /* Régua do dia: os blocos da agenda numa linha do tempo, com o "agora" marcado */
    dayRail(k, { link = true } = {}) {
      const bl = D.dayBlocks(k).filter(b => b.status !== 'cancelada');
      let a = U.toMin(S.settings.workStart), z = U.toMin(S.settings.workEnd);
      bl.forEach(b => { a = Math.min(a, U.toMin(b.start)); z = Math.max(z, U.toMin(b.end)); });
      if (!(z > a)) return '';
      const pos = m => ((m - a) / (z - a) * 100).toFixed(2);
      const t = U.today(), now = U.nowMin();
      const segs = bl.map(b => {
        const cls = D.isBreak(b) ? 's-break' : b.status === 'concluida' ? 's-done' : D.blockNow(b, k) ? 's-now' : D.blockLate(b, k) ? 's-late' : b.status === 'andamento' ? 's-run' : 's-pend';
        return `<span class="seg ${cls}" style="left:${pos(U.toMin(b.start))}%;width:calc(${(pos(U.toMin(b.end)) - pos(U.toMin(b.start))).toFixed(2)}% - 2px)" title="${b.start}–${b.end} ${U.esc(b.title)}"></span>`;
      }).join('');
      const ticks = [];
      for (let h = Math.ceil(a / 60); h * 60 <= z; h += (z - a) > 600 ? 2 : 1) ticks.push(`<span style="left:${pos(h * 60)}%">${U.pad(h)}h</span>`);
      const nowM = k === t && now >= a && now <= z ? `<span class="rail-now" style="left:${pos(now)}%"></span>` : '';
      const tag = link ? `a href="#agenda" data-act="goAgenda" data-d="${k}"` : 'div';
      return `<${tag} class="rail" aria-label="Linha do tempo do dia"><span class="rail-track">${segs}${nowM}</span><span class="rail-ticks">${ticks.join('')}</span></${link ? 'a' : 'div'}>`;
    },
    empty: (msg, action = '') => `<div class="empty">${U.icon('info', 22)}<p>${msg}</p>${action}</div>`,
    demo: x => x && x.demo ? '<span class="demo-badge">EXEMPLO</span>' : '',
    catOptions: () => S.settings.categories.map(c => [c.id, c.name]),
    prioOptions: () => ['baixa', 'media', 'alta', 'urgente'].map(p => [p, D.prio(p).label]),
    statusOptions: () => ['pendente', 'andamento', 'concluida', 'cancelada'].map(s => [s, D.status(s).label]),
    techOptions: (cur) => { const names = D.techNames(); if (cur && !names.includes(cur)) names.push(cur); return [['', '— Não definido —'], ...names.map(n => [n, n])]; },
  };

  return { modal, form, confirm, sheet, toast, H, opts };
})();
const H = UI.H;

/* Registro de telas e ações (preenchido pelos arquivos em js/views) */
const Views = {};
const Actions = {};
