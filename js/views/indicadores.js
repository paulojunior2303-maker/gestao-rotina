'use strict';
/* Indicadores e relatórios — dados lançados manualmente; sem dados = "sem dados" */
const Ind = {
  range() {
    const f = App.ui.indF = App.ui.indF || { period: 'mes', from: '', to: '', metric: 'osConcluidas', gran: 'diario' };
    const t = U.today();
    if (f.period === 'semana') { const ws = U.weekStart(t); return [ws, U.addDays(ws, 6), 'Semana atual']; }
    if (f.period === 'mes') { const mk = U.monthKey(t); return [U.monthStart(mk), U.monthEnd(mk), U.fmtMonth(mk)]; }
    if (f.period === 'mesant') { const mk = U.addMonths(U.monthKey(t), -1); return [U.monthStart(mk), U.monthEnd(mk), U.fmtMonth(mk)]; }
    if (f.period === 'ano') { const y = t.slice(0, 4); return [`${y}-01-01`, `${y}-12-31`, `Ano de ${y}`]; }
    const from = f.from || U.addDays(t, -30), to = f.to || t;
    return [from, to, `${U.fmtDate(from)} a ${U.fmtDate(to)}`];
  },
  buckets(from, to, gran) {
    if (gran === 'mensal') { const out = []; for (let mk = U.monthKey(from); mk <= U.monthKey(to); mk = U.addMonths(mk, 1)) out.push({ label: U.MONTHS[Number(mk.slice(5)) - 1].slice(0, 3) + '/' + mk.slice(2, 4), from: U.monthStart(mk) < from ? from : U.monthStart(mk), to: U.monthEnd(mk) > to ? to : U.monthEnd(mk) }); return out; }
    if (gran === 'semanal') { const out = []; for (let ws = U.weekStart(from); ws <= to; ws = U.addDays(ws, 7)) out.push({ label: U.fmtShort(ws), from: ws < from ? from : ws, to: U.addDays(ws, 6) > to ? to : U.addDays(ws, 6) }); return out; }
    let days = U.daysInRange(from, to);
    if (days.length > 62) days = days.slice(-62);
    return days.map(k => ({ label: U.fmtShort(k), from: k, to: k }));
  },
  techRows(from, to) {
    const names = [...new Set([...D.techNames(), ...D.records(from, to).map(r => r.technician).filter(Boolean)])];
    return names.map(n => {
      const recs = D.records(from, to).filter(r => r.technician === n);
      const v = m => D.metricValue(m, from, to, r => r.technician === n);
      return { name: n, days: new Set(recs.map(r => r.date)).size, osConcluidas: v('osConcluidas'), pontosCamera: v('pontosCamera'), manutencoes: v('manutencoes'), retrabalhos: v('retrabalhos') };
    });
  },
  form(r) {
    const isNew = !r;
    r = r || { date: U.today(), technician: '', values: {} };
    UI.form({
      title: isNew ? 'Lançar dados de indicadores' : 'Editar lançamento', wide: true,
      fields: [
        { type: 'html', html: '<p class="muted small">Preencha apenas o que você tem. Campos em branco ficam como <strong>sem dados</strong> (não são tratados como zero). Para O.S. pendentes/atrasadas, informe a posição no dia.</p>' },
        { name: 'date', label: 'Data', type: 'date', required: true, value: r.date, half: true },
        { name: 'technician', label: 'Técnico', type: 'select', options: H.techOptions(r.technician).map(([v, l]) => [v, v ? l : 'Equipe (geral)']), value: r.technician, half: true, hint: D.techNames().length ? '' : 'Cadastre técnicos em Configurações para lançar produtividade individual.' },
        ...METRICS.map(m => ({ name: m.key, label: m.label, type: 'number', min: 0, step: 1, value: r.values[m.key], half: true })),
        { name: 'notes', label: 'Observações', type: 'textarea', rows: 2, value: r.notes },
      ],
      validate: v => METRICS.every(m => v[m.key] === null) ? 'Preencha pelo menos um indicador.' : (METRICS.some(m => v[m.key] !== null && v[m.key] < 0) ? 'Os valores não podem ser negativos.' : null),
      onSubmit(v) {
        const values = {}; METRICS.forEach(m => { values[m.key] = v[m.key]; });
        if (isNew) S.indicators.push({ id: U.uid(), date: v.date, technician: v.technician, notes: v.notes, values });
        else Object.assign(r, { date: v.date, technician: v.technician, notes: v.notes, values });
        commit(); UI.toast('Lançamento salvo.');
      },
    });
  },
};

Views.indicadores = {
  title: 'Indicadores e relatórios', icon: 'chart', nav: 'Indicadores',
  render() {
    const [from, to, label] = Ind.range();
    const f = App.ui.indF;
    const recs = D.records(from, to).sort((a, b) => b.date.localeCompare(a.date) || (a.technician || '').localeCompare(b.technician || ''));
    const val = m => D.metricValue(m, from, to);
    const rec = val('osRecebidas'), con = val('osConcluidas'), ret = val('retrabalhos');
    const projDone = D.metricValue('projetosConcluidos', from, to);
    const projAnd = S.projects.filter(p => p.status === 'andamento').length;
    const goals = S.settings.goals.map(g => ({ g, st: D.goalStatus(g, to < U.today() ? to : U.today()) }));
    const goalsWithData = goals.filter(x => x.st.achieved !== null);

    const kpi = (m) => {
      const v = val(m.key);
      const sub = m.snapshot ? (v === null ? '' : `posição em ${U.fmtShort(D.lastDateWith(m.key, from, to))}`) : 'soma no período';
      return `<div class="kpi ${v === null ? 'nodata' : ''}"><span class="kpi-l">${m.label}</span><strong class="kpi-v">${v === null ? '—' : U.fmtNum(v)}</strong><span class="kpi-s">${v === null ? 'Sem dados' : sub}</span></div>`;
    };

    const b = Ind.buckets(from, to, f.gran);
    const metricMeta = METRICS.find(m => m.key === f.metric) || METRICS[1];
    const series1 = [{ name: metricMeta.label, color: '#2563eb', values: b.map(x => D.metricValue(metricMeta.key, x.from, x.to)) }];
    const series2 = [
      { name: 'O.S. recebidas', color: '#94a3b8', values: b.map(x => D.metricValue('osRecebidas', x.from, x.to)) },
      { name: 'O.S. concluídas', color: '#16a34a', values: b.map(x => D.metricValue('osConcluidas', x.from, x.to)) },
    ];
    const techs = Ind.techRows(from, to);
    const techWithData = techs.filter(r => r.days);

    return `
    <div class="toolbar">
      <div class="tabs">
        ${[['semana', 'Semana'], ['mes', 'Mês atual'], ['mesant', 'Mês anterior'], ['ano', 'Ano'], ['custom', 'Personalizado']].map(([v, l]) => `<button class="tab ${f.period === v ? 'active' : ''}" data-act="indPeriod" data-v="${v}">${l}</button>`).join('')}
      </div>
      ${f.period === 'custom' ? `<label class="inline">De <input type="date" value="${from}" data-change="indDate" data-k="from"></label><label class="inline">Até <input type="date" value="${to}" data-change="indDate" data-k="to"></label>` : ''}
      <span class="grow"></span>
      <button class="btn ghost" data-act="indXlsx">${U.icon('download')} Excel</button>
      <button class="btn ghost" data-act="indPdf">${U.icon('printer')} PDF</button>
      <button class="btn primary" data-act="indNew">${U.icon('plus')} Lançar dados</button>
    </div>
    <p class="muted small">Período: <strong>${label}</strong> (${U.fmtDate(from)} a ${U.fmtDate(to)}) · ${U.plural(recs.length, 'lançamento')}</p>

    <section class="kpis kpis-ind">
      ${METRICS.map(kpi).join('')}
      <div class="kpi ${rec && con !== null ? '' : 'nodata'}"><span class="kpi-l">Taxa de conclusão de O.S.</span><strong class="kpi-v">${rec && con !== null ? Math.round(con / rec * 100) + '%' : '—'}</strong><span class="kpi-s">${rec && con !== null ? 'concluídas ÷ recebidas' : 'Sem dados'}</span></div>
      <div class="kpi ${con && ret !== null ? '' : 'nodata'}"><span class="kpi-l">Índice de retrabalho</span><strong class="kpi-v">${con && ret !== null ? (ret / con * 100).toFixed(1).replace('.', ',') + '%' : '—'}</strong><span class="kpi-s">${con && ret !== null ? 'retrabalhos ÷ O.S. concluídas' : 'Sem dados'}</span></div>
      <div class="kpi"><span class="kpi-l">Projetos concluídos</span><strong class="kpi-v">${projDone}</strong><span class="kpi-s">no período</span></div>
      <div class="kpi"><span class="kpi-l">Projetos em andamento</span><strong class="kpi-v">${projAnd}</strong><span class="kpi-s">situação atual</span></div>
      <div class="kpi ${goalsWithData.length ? '' : 'nodata'}"><span class="kpi-l">Metas alcançadas</span><strong class="kpi-v">${goals.length ? `${goalsWithData.filter(x => x.st.achieved).length}/${goals.length}` : '—'}</strong><span class="kpi-s">${goals.length ? (goalsWithData.length ? 'período vigente de cada meta' : 'Sem dados') : 'Nenhuma meta configurada'}</span></div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h3>Acompanhamento</h3>
          <div class="chart-ctrl">
            <select data-change="indSet" data-k="metric">${UI.opts(METRICS.map(m => [m.key, m.label]), f.metric)}</select>
            <select data-change="indSet" data-k="gran">${UI.opts([['diario', 'Diário'], ['semanal', 'Semanal'], ['mensal', 'Mensal']], f.gran)}</select>
          </div></div>
        ${Charts.bars({ labels: b.map(x => x.label), series: series1 })}
        ${metricMeta.snapshot ? '<p class="muted small">Indicador de posição: cada barra mostra o último valor registrado no intervalo.</p>' : ''}
      </div>
      <div class="card">
        <div class="card-h"><h3>O.S. recebidas × concluídas</h3><span class="muted small">${{ diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' }[f.gran]}</span></div>
        ${Charts.bars({ labels: b.map(x => x.label), series: series2 })}
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="card-h"><h3>${U.icon('user')} Produtividade por técnico</h3></div>
        ${techWithData.length ? `${Charts.hbars(techWithData.map(r => ({ label: r.name, value: r.osConcluidas, color: '#16a34a' })), ' O.S.')}
          <div class="table-wrap"><table class="table"><thead><tr><th>Técnico</th><th>Dias</th><th>O.S. concl.</th><th>Pontos câm.</th><th>Manut.</th><th>Retrab.</th></tr></thead>
          <tbody>${techWithData.map(r => `<tr><td>${U.esc(r.name)}</td><td>${r.days}</td><td>${U.fmtNum(r.osConcluidas)}</td><td>${U.fmtNum(r.pontosCamera)}</td><td>${U.fmtNum(r.manutencoes)}</td><td>${U.fmtNum(r.retrabalhos)}</td></tr>`).join('')}</tbody></table></div>`
          : H.empty(D.techNames().length ? 'Nenhum lançamento por técnico no período.' : 'Cadastre os técnicos em Configurações e lance os dados por técnico para ver a produtividade individual.')}
      </div>
      <div class="card">
        <div class="card-h"><h3>${U.icon('target')} Metas</h3><a class="link" href="#config">Configurar</a></div>
        ${goals.length ? goals.map(({ g, st }) => `<div class="goal"><div class="goal-h"><span>${U.esc(g.name || GOAL_METRICS.find(m => m.key === g.metric)?.label)}</span>${H.demo(g)}${st.achieved === null ? '<span class="badge">Sem dados</span>' : st.achieved ? '<span class="badge b-green">Alcançada</span>' : '<span class="badge b-yellow">Não alcançada</span>'}</div>${H.bar(st.pct, st.achieved ? 'var(--green)' : 'var(--yellow)')}<small class="muted">${st.val === null ? 'Sem dados' : U.fmtNum(st.val)} / ${g.direction === 'max' ? 'máx. ' : ''}${U.fmtNum(st.target)} · ${g.period} (${U.fmtShort(st.from)}–${U.fmtShort(st.to)})</small></div>`).join('') : H.empty('Nenhuma meta configurada.')}
      </div>
    </section>

    <div class="card">
      <div class="card-h"><h3>Lançamentos do período</h3><span class="muted small">Totais somam todos os lançamentos. Se lançar por técnico, não repita os mesmos números como "Equipe (geral)".</span></div>
      ${recs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Técnico</th>${METRICS.map(m => `<th title="${m.label}">${m.label.replace('O.S. ', 'O.S. ').replace('Pontos de câmera instalados', 'Pontos câm.').replace('Manutenções realizadas', 'Manut.')}</th>`).join('')}<th></th></tr></thead>
        <tbody>${recs.map(r => `<tr><td>${U.fmtDate(r.date)}</td><td>${U.esc(r.technician || 'Equipe (geral)')}${H.demo(r)}</td>${METRICS.map(m => `<td>${r.values[m.key] === null || r.values[m.key] === undefined ? '<span class="muted">—</span>' : r.values[m.key]}</td>`).join('')}<td class="nowrap"><button class="icon-btn xs" data-act="indEdit" data-id="${r.id}">${U.icon('edit', 14)}</button><button class="icon-btn xs" data-act="indDel" data-id="${r.id}">${U.icon('trash', 14)}</button></td></tr>`).join('')}</tbody></table></div>`
        : H.empty('Nenhum dado lançado neste período.', '<button class="btn sm primary" data-act="indNew">Lançar dados</button>')}
    </div>`;
  },
};

Object.assign(Actions, {
  indPeriod({ v }) { App.ui.indF.period = v; if (v === 'custom' && !App.ui.indF.from) { App.ui.indF.from = U.addDays(U.today(), -30); App.ui.indF.to = U.today(); } App.render(); },
  indDate({ k }, el) { App.ui.indF[k] = el.value; App.render(); },
  indSet({ k }, el) { App.ui.indF[k] = el.value; App.render(); },
  indNew() { Ind.form(null); },
  indEdit({ id }) { Ind.form(S.indicators.find(r => r.id === id)); },
  indDel({ id }) { UI.confirm('Excluir este lançamento?', () => { S.indicators = S.indicators.filter(r => r.id !== id); commit(); }, { danger: true, okLabel: 'Excluir' }); },
  indXlsx() { const [from, to, label] = Ind.range(); Reports.xlsx(from, to, label); },
  indPdf() { const [from, to, label] = Ind.range(); Reports.pdf(from, to, label); },
});
