'use strict';
/* Agenda → Semana: para cada dia, o foco e o checklist (que se repetem toda semana), os compromissos,
   reuniões e prazos do dia e o andamento da agenda */
const WeekPlan = {
  render() {
    const ws = App.ui.weekStart || U.weekStart(U.today());
    const t = U.today();
    const chk = S.weekly.checks[ws] || {};
    const days = [1, 2, 3, 4, 5, 6, 0].filter(d => S.settings.workDays.includes(d));
    const focusOf = d => S.weekly.focus.find(f => f.day === d);
    const all = days.flatMap(d => (focusOf(d) || { items: [] }).items);
    const done = all.filter(i => chk[i.id]).length;
    const pct = all.length ? Math.round(done / all.length * 100) : null;

    const col = d => {
      const k = U.addDays(ws, (d + 6) % 7);
      const f = focusOf(d);
      const items = f ? f.items : [];
      const dn = items.filter(i => chk[i.id]).length;
      const p = items.length ? Math.round(dn / items.length * 100) : null;
      const dueTasks = S.tasks.filter(x => OPEN(x.status) && x.dueDate === k).length;
      const ag = D.progress(k);
      const empty = !(f && f.title) && !items.length;
      return `<div class="wk-col card ${k === t ? 'is-today' : ''} ${empty ? 'is-empty' : ''}">
        <div class="wk-h">
          <div><small>${U.WD[d]}, ${U.fmtShort(k)}${k === t ? ' · hoje' : ''}</small>
          <h3>${f && f.title ? U.esc(f.title) : '<span class="muted">Sem foco definido</span>'}</h3></div>
          <button class="icon-btn" data-act="wkFocus" data-d="${d}" title="${f && f.title ? 'Editar foco' : 'Definir foco'}" aria-label="${f && f.title ? 'Editar foco' : 'Definir foco'}">${U.icon('edit', 15)}</button>
        </div>
        ${items.length ? `${H.bar(p, p === 100 ? 'var(--green)' : null)}<small class="muted">${dn} de ${items.length} concluídos</small>` : ''}
        ${(() => { const its = Cal.itemsOn(k); return its.length ? `<ul class="wk-items">${its.map(i => `<li class="t-${i.type} ${i.done ? 'done' : ''} ${i.late ? 'late' : ''}" data-act="${i.act}" data-id="${i.id}"><i></i><span>${i.time ? `<b>${i.time}</b> ` : ''}${U.esc(i.label)}</span></li>`).join('')}</ul>` : ''; })()}
        <ul class="checklist">${items.map(i => `<li><label class="check"><input type="checkbox" data-change="wkCheck" data-id="${i.id}" ${chk[i.id] ? 'checked' : ''}><span>${U.esc(i.text)}</span></label><button class="icon-btn xs" data-act="wkItemEdit" data-d="${d}" data-id="${i.id}" title="Editar item">${U.icon('edit', 13)}</button></li>`).join('')}</ul>
        <button class="btn sm ghost add-item" data-act="wkItemAdd" data-d="${d}">${U.icon('plus', 15)} Adicionar item</button>
        <div class="wk-foot">
          <a href="#agenda" data-act="goAgenda" data-d="${k}" class="link small">Abrir o dia${ag.pct === null ? '' : ` · ${ag.pct}%`}</a>
        </div>
      </div>`;
    };

    return `
    <div class="plan-intro">
      <p>A semana inteira num lugar: compromissos e prazos de cada dia, o <strong>foco</strong> e o que não pode faltar (a lista se repete toda semana; as marcações valem só para a semana exibida).</p>
      <button class="link" data-act="guideOpen" data-id="semanal">Como funciona</button>
    </div>
    <div class="toolbar">
      <div class="date-nav">
        <button class="icon-btn" data-act="wkShift" data-n="-7" aria-label="Semana anterior">${U.icon('left')}</button>
        <strong class="range-lbl">${U.fmtShort(ws)} a ${U.fmtShort(U.addDays(ws, 6))}</strong>
        <button class="icon-btn" data-act="wkShift" data-n="7" aria-label="Próxima semana">${U.icon('right')}</button>
        ${ws !== U.weekStart(t) ? '<button class="btn sm ghost" data-act="wkShift" data-n="0">Semana atual</button>' : ''}
      </div>
    </div>
    <div class="card wk-summary">
      ${all.length ? `<div>${Charts.ring(pct, { size: 72, stroke: 7 })}</div>` : ''}
      <div class="grow">
        <h3>Checklist da semana</h3>
        <p class="muted">${all.length ? `${done} de ${U.plural(all.length, 'item', 'itens')} concluídos nesta semana.` : 'Ainda não há itens. Comece tocando no lápis de um dia para definir o foco, depois em “Adicionar item”.'}</p>
        ${all.length ? H.bar(pct) : ''}
      </div>
      ${Object.keys(chk).length ? `<button class="btn sm ghost" data-act="wkReset">${U.icon('undo', 15)} Desmarcar semana</button>` : ''}
    </div>
    <div class="wk-grid">${days.map(col).join('')}</div>`;
  },
};

Object.assign(Actions, {
  wkShift({ n }) { n = Number(n); const cur = App.ui.weekStart || U.weekStart(U.today()); App.ui.weekStart = n === 0 ? U.weekStart(U.today()) : U.addDays(cur, n); App.render(); },
  wkCheck({ id }, el) {
    const ws = App.ui.weekStart || U.weekStart(U.today());
    const c = S.weekly.checks[ws] = S.weekly.checks[ws] || {};
    if (el.checked) c[id] = true; else delete c[id];
    commit();
  },
  wkReset() { const ws = App.ui.weekStart || U.weekStart(U.today()); UI.confirm('Desmarcar todos os itens desta semana?', () => { delete S.weekly.checks[ws]; commit(); }); },
  wkFocus({ d }) {
    d = Number(d);
    let f = S.weekly.focus.find(x => x.day === d);
    UI.form({
      title: `Foco de ${U.WD[d]}`,
      fields: [{ name: 'title', label: 'Foco do dia', value: f ? f.title : '', placeholder: 'Ex.: Planejamento, Operação, Equipe…', hint: 'Um tema curto que resume o que você prioriza nesse dia. Pode deixar em branco.' }],
      onSubmit(v) {
        if (!f) { f = { day: d, title: '', items: [] }; S.weekly.focus.push(f); }
        f.title = v.title;
        if (!f.title && !f.items.length) S.weekly.focus = S.weekly.focus.filter(x => x !== f);
        commit();
      },
    });
  },
  wkItemAdd({ d }) {
    d = Number(d);
    UI.form({
      title: `Novo item — ${U.WD[d]}`,
      fields: [{ name: 'text', label: 'Item do checklist', required: true, placeholder: 'Ex.: Conferir escala da equipe' }],
      onSubmit(v) {
        let f = S.weekly.focus.find(x => x.day === d);
        if (!f) { f = { day: d, title: '', items: [] }; S.weekly.focus.push(f); }
        f.items.push({ id: U.uid(), text: v.text }); commit();
      },
    });
  },
  wkItemEdit({ d, id }) {
    const f = S.weekly.focus.find(x => x.day === Number(d)); const it = f.items.find(i => i.id === id);
    UI.form({
      title: 'Editar item',
      fields: [{ name: 'text', label: 'Item do checklist', required: true, value: it.text }],
      extra: [{ label: `${U.icon('trash', 15)} Excluir`, cls: 'ghost danger-text', onClick: (_, m) => { m.close(); f.items = f.items.filter(i => i.id !== id); if (!f.title && !f.items.length) S.weekly.focus = S.weekly.focus.filter(x => x !== f); commit(); UI.toast('Item excluído.'); } }],
      onSubmit(v) { it.text = v.text; commit(); },
    });
  },
});
