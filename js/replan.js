'use strict';
/* "Reorganizar meu dia": refaz os horários do que ainda falta, a partir de agora, na mesma ordem.
   Não mexe no que tem horário fixo (nem no intervalo), no que já foi concluído/cancelado nem no que está em andamento.
   O que não couber até o fim do expediente pode ir para o próximo dia útil. Sempre com "Desfazer". */
const Replan = {
  /* Calcula o novo plano sem gravar. includeLate: também o que ficou para trás. */
  plan(k = U.today(), { includeLate = true, from } = {}) {
    const day = D.sortBlocks(D.dayBlocks(k).slice());
    const t = U.today();
    const nowR = Math.ceil(U.nowMin() / 5) * 5;
    let cursor = from ?? (k === t ? nowR : U.toMin(S.settings.workStart));
    const run = day.find(b => b.status === 'andamento' && !D.isBreak(b));
    if (run && k === t) cursor = Math.max(cursor, U.toMin(run.end));
    const fixed = day.filter(b => (b.fixed || D.isBreak(b)) && b.status !== 'cancelada');
    const movable = day.filter(b => !b.fixed && !D.isBreak(b) && !D.blockDone(b) && b.status !== 'andamento'
      && (includeLate || U.toMin(b.start) >= cursor || k !== t));
    const end = U.toMin(S.settings.workEnd);
    const out = [];
    for (const b of movable) {
      const dur = Math.max(5, U.toMin(b.end) - U.toMin(b.start));
      let s = cursor;
      for (let g = 0; g < 20; g++) {
        const hit = fixed.find(f => s < U.toMin(f.end) && s + dur > U.toMin(f.start));
        if (!hit) break;
        s = U.toMin(hit.end);
      }
      const e = s + dur;
      out.push({ b, start: U.fromMin(s), end: U.fromMin(Math.min(1439, e)), over: e > end || e > 1439, changed: U.fromMin(s) !== b.start });
      cursor = e;
    }
    return out;
  },

  /* Aplica um plano. overflow: 'amanha' (vai para o próximo dia útil) | 'fica' (fica depois do horário) */
  apply(k, plan, overflow = 'fica') {
    const snap = JSON.stringify(S.days);
    const occSnap = JSON.stringify(S.occurrences.map(o => [o.id, o.scheduled]));
    const to = D.nextWorkday(k);
    let moved = 0, sent = 0;
    for (const p of plan) {
      const b = D.findBlock(k, p.b.id); if (!b) continue;
      if (p.over && overflow === 'amanha') { D.moveBlock(k, b.id, to); sent++; continue; }
      if (p.changed) { b.start = p.start; b.end = p.end; moved++; }
    }
    return {
      moved, sent, to,
      undo() { S.days = JSON.parse(snap); const m = new Map(JSON.parse(occSnap)); S.occurrences.forEach(o => { if (m.has(o.id)) o.scheduled = m.get(o.id); }); },
    };
  },

  /* Usado depois de concluir algo antes da hora: puxa o que vem depois para agora */
  fromNow({ quiet = true } = {}) {
    const k = U.today();
    const plan = Replan.plan(k, { includeLate: false });
    const r = Replan.apply(k, plan, 'fica');
    commit();
    if (!quiet) UI.toast(r.moved ? `${U.plural(r.moved, 'atividade adiantada', 'atividades adiantadas')}.` : 'Nada para adiantar.', 'ok', r.moved ? { label: 'Desfazer', onClick: () => { r.undo(); commit(); } } : undefined);
    return r;
  },

  /* Janela com a prévia: como o dia vai ficar */
  open(k = U.today()) {
    const t = U.today();
    let overflow = 'amanha', includeLate = true;
    const render = () => {
      const plan = Replan.plan(k, { includeLate });
      const late = D.dayBlocks(k).filter(b => D.blockLate(b, k)).length;
      const over = plan.filter(p => p.over).length;
      const rows = plan.map(p => `<li class="rp-li ${p.over ? 'rp-over' : ''}"><span class="rp-t">${p.changed ? `<s>${p.b.start}</s> ` : ''}<strong>${p.over && overflow === 'amanha' ? U.fmtShort(D.nextWorkday(k)) : p.start}</strong></span><span class="rp-n">${U.esc(p.b.title)}</span></li>`).join('');
      return `<div class="rp">
        <p class="muted small">${k === t ? 'A partir de agora' : 'A partir do início do expediente'}, o que falta fazer entra em sequência, na mesma ordem. O que tem horário fixo e o intervalo não mudam.</p>
        ${late ? `<label class="check"><input type="checkbox" id="rp-late" ${includeLate ? 'checked' : ''}> <span>Incluir ${U.plural(late, 'atividade que ficou', 'atividades que ficaram')} para trás</span></label>` : ''}
        ${plan.length ? `<ul class="rp-list">${rows}</ul>` : H.empty('Não há nada para reorganizar.')}
        ${over ? `<div class="field"><span class="lbl">${U.plural(over, 'atividade passa', 'atividades passam')} do fim do expediente (${S.settings.workEnd}):</span>
          <label class="check radio"><input type="radio" name="rp-over" value="amanha" ${overflow === 'amanha' ? 'checked' : ''}> <span>Mandar para ${U.fmtLong(D.nextWorkday(k)).split(',')[0].toLowerCase()} (${U.fmtShort(D.nextWorkday(k))})</span></label>
          <label class="check radio"><input type="radio" name="rp-over" value="fica" ${overflow === 'fica' ? 'checked' : ''}> <span>Deixar hoje, depois do horário</span></label></div>` : ''}
      </div>`;
    };
    const m = UI.modal({
      title: 'Reorganizar meu dia', body: render(),
      footer: '<span class="grow"></span><button class="btn ghost" data-no>Cancelar</button><button class="btn primary" data-yes>Reorganizar</button>',
    });
    m.el.addEventListener('change', e => {
      if (e.target.id === 'rp-late') includeLate = e.target.checked;
      if (e.target.name === 'rp-over') overflow = e.target.value;
      m.setBody(render());
    });
    m.el.querySelector('[data-no]').onclick = () => m.close();
    m.el.querySelector('[data-yes]').onclick = () => {
      const plan = Replan.plan(k, { includeLate });
      const r = Replan.apply(k, plan, overflow);
      commit(); m.close();
      const msg = r.moved || r.sent ? [r.moved ? `${U.plural(r.moved, 'atividade reorganizada', 'atividades reorganizadas')}` : '', r.sent ? `${r.sent} para ${U.fmtShort(r.to)}` : ''].filter(Boolean).join(' · ') + '.' : 'O dia já estava em ordem.';
      UI.toast(msg, 'ok', (r.moved || r.sent) ? { label: 'Desfazer', onClick: () => { r.undo(); commit(); UI.toast('Desfeito.'); } } : undefined);
    };
  },
};

Object.assign(Actions, {
  replanOpen() { Replan.open(typeof Agenda !== 'undefined' && App.route === 'agenda' ? Agenda.day() : U.today()); },
});
