'use strict';
/* Relatórios: exportação Excel (.xlsx) e PDF (via impressão do navegador) */
const Reports = {
  data(from, to) {
    const metrics = METRICS.map(m => [m.label, D.metricValue(m.key, from, to), m.snapshot ? 'Último valor registrado' : 'Soma no período']);
    const techs = Ind.techRows(from, to).filter(r => r.days);
    const goals = S.settings.goals.map(g => { const st = D.goalStatus(g, to < U.today() ? to : U.today()); return [g.name || metricLabel(g.metric), g.period, (g.direction === 'max' ? '≤ ' : '≥ ') + g.target, st.val, st.achieved === null ? 'Sem dados' : st.achieved ? 'Alcançada' : 'Não alcançada']; });
    const tasks = S.tasks.filter(x => OPEN(x.status) || (x.completedAt && x.completedAt.slice(0, 10) >= from && x.completedAt.slice(0, 10) <= to) || (x.dueDate && x.dueDate >= from && x.dueDate <= to));
    const occ = S.occurrences.filter(o => (o.date >= from && o.date <= to) || OPEN(o.status));
    const days = U.daysInRange(from, to > U.today() ? U.today() : to).filter(k => S.days[k] && S.days[k].length).map(k => { const p = D.progress(k); return [U.fmtDate(k), U.WD[U.weekday(k)], p.total, p.done, p.pct === null ? null : p.pct / 100]; });
    return { metrics, techs, goals, tasks, occ, days };
  },

  xlsx(from, to, label) {
    const d = Reports.data(from, to);
    const sheets = [
      { name: 'Resumo', rows: [['Relatório de gestão', label], ['Período', `${U.fmtDate(from)} a ${U.fmtDate(to)}`], ['Gerado em', U.fmtDateTime(new Date().toISOString())], [], ['Indicador', 'Valor', 'Observação'], ...d.metrics.map(([l, v, o]) => [l, v === null ? 'Sem dados' : v, o]),
        ['Projetos concluídos no período', D.metricValue('projetosConcluidos', from, to), ''], ['Projetos em andamento (atual)', S.projects.filter(p => p.status === 'andamento').length, ''], ['Tarefas concluídas no período', D.metricValue('tarefasConcluidas', from, to), '']] },
      { name: 'Lançamentos', rows: [['Data', 'Pessoa', ...METRICS.map(m => m.label), 'Observações'], ...D.records(from, to).sort((a, b) => a.date.localeCompare(b.date)).map(r => [U.fmtDate(r.date), r.technician || 'Equipe (geral)', ...METRICS.map(m => r.values[m.key] ?? null), r.notes || ''])] },
      { name: 'Produtividade por pessoa', rows: [['Pessoa', 'Dias com lançamento', ...METRICS.map(m => m.label)], ...d.techs.map(r => [r.name, r.days, r.pontosCamera, r.manutencoes, r.retrabalhos])] },
      { name: 'Metas', rows: [['Meta', 'Período', 'Alvo', 'Realizado', 'Situação'], ...d.goals] },
      { name: 'Tarefas', rows: [['Nome', 'Categoria', 'Prioridade', 'Status', 'Responsável', 'Criada em', 'Início', 'Prazo', 'Horário', 'Concluída em', 'Descrição', 'Observações'], ...d.tasks.map(x => [x.title, D.cat(x.category).name, D.prio(x.priority).label, D.status(x.status).label, x.responsible || '', U.fmtDateTime(x.createdAt), x.startDate ? U.fmtDate(x.startDate) : '', x.dueDate ? U.fmtDate(x.dueDate) : '', x.dueTime || '', x.completedAt ? U.fmtDateTime(x.completedAt) : '', x.description || '', x.notes || ''])] },
      { name: 'Projetos', rows: [['Projeto', 'Cliente', 'Responsável', 'Status', '% concluído', 'Início', 'Prazo', 'Etapas', 'Pendências abertas', 'Observações'], ...S.projects.map(p => [p.name, p.client || '', p.responsible || '', PROJECT_STATUS[p.status].label, D.projectProgress(p) / 100, p.startDate ? U.fmtDate(p.startDate) : '', p.dueDate ? U.fmtDate(p.dueDate) : '', (p.stages || []).map(s => (s.done ? '[x] ' : '[ ] ') + s.name).join('; '), (p.pendencias || []).filter(x => !x.done).map(x => x.text).join('; '), p.notes || ''])] },
      { name: 'Imprevistos', rows: [['Título', 'Prioridade', 'Status', 'Data', 'Hora', 'Prazo', 'Responsável', 'Descrição', 'Observações'], ...d.occ.map(o => [o.title, D.prio(o.priority).label, D.status(o.status).label, U.fmtDate(o.date), o.time || '', o.dueDate ? U.fmtDate(o.dueDate) + (o.dueTime ? ' ' + o.dueTime : '') : '', o.responsible || '', o.description || '', o.notes || ''])] },
      { name: 'Agenda', rows: [['Data', 'Dia', 'Atividades', 'Concluídas', '% concluído (0–1)'], ...d.days] },
    ];
    try {
      U.download(`relatorio-gestao_${from}_${to}.xlsx`, XLSX.build(sheets));
      UI.toast('Planilha Excel gerada.');
    } catch (e) { UI.toast('Não foi possível gerar a planilha: ' + e.message, 'error'); }
  },

  pdf(from, to, label) {
    const d = Reports.data(from, to);
    const table = (head, rows) => rows.length ? `<table><thead><tr>${head.map(h => `<th>${U.esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c === null || c === undefined ? '<em>sem dados</em>' : U.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p><em>Sem dados.</em></p>';
    const body = `
      <div class="report">
        <header><h1>Relatório de gestão operacional</h1><p>${U.esc(label)} — ${U.fmtDate(from)} a ${U.fmtDate(to)} · gerado em ${U.fmtDateTime(new Date().toISOString())}</p></header>
        <h2>Indicadores</h2>${table(['Indicador', 'Valor', 'Observação'], d.metrics.map(([l, v, o]) => [l, v === null ? null : U.fmtNum(v), o]))}
        <p>Projetos concluídos no período: <strong>${D.metricValue('projetosConcluidos', from, to)}</strong> · Projetos em andamento: <strong>${S.projects.filter(p => p.status === 'andamento').length}</strong> · Tarefas concluídas no período: <strong>${D.metricValue('tarefasConcluidas', from, to)}</strong></p>
        <h2>Produtividade por pessoa</h2>${table(['Pessoa', 'Dias', ...METRICS.map(m => m.label)], d.techs.map(r => [r.name, r.days, U.fmtNum(r.pontosCamera), U.fmtNum(r.manutencoes), U.fmtNum(r.retrabalhos)]))}
        <h2>Metas</h2>${table(['Meta', 'Período', 'Alvo', 'Realizado', 'Situação'], d.goals.map(g => [g[0], g[1], g[2], g[3] === null ? null : U.fmtNum(g[3]), g[4]]))}
        <h2>Projetos</h2>${table(['Projeto', 'Cliente', 'Responsável', 'Status', '%', 'Prazo'], S.projects.filter(p => p.status !== 'cancelado').map(p => [p.name, p.client || '—', p.responsible || '—', PROJECT_STATUS[p.status].label, D.projectProgress(p) + '%', U.fmtDate(p.dueDate)]))}
        <h2>Tarefas</h2>${table(['Tarefa', 'Prioridade', 'Status', 'Responsável', 'Prazo'], d.tasks.map(x => [x.title, D.prio(x.priority).label, D.status(x.status).label + (D.taskLate(x) ? ' (atrasada)' : ''), x.responsible || '—', x.dueDate ? U.fmtDate(x.dueDate) : '—']))}
        <h2>Imprevistos</h2>${table(['Imprevisto', 'Prioridade', 'Status', 'Data', 'Responsável'], d.occ.map(o => [o.title, D.prio(o.priority).label, D.status(o.status).label, U.fmtDate(o.date), o.responsible || '—']))}
        <h2>Execução da agenda</h2>${table(['Data', 'Dia', 'Atividades', 'Concluídas', '%'], d.days.map(r => [r[0], r[1], r[2], r[3], r[4] === null ? '—' : Math.round(r[4] * 100) + '%']))}
      </div>`;
    const native = Native.available();
    if (Cloud.downloads || native) {
      // No claude.ai a impressão é bloqueada (baixa o relatório); no app Android abre a impressão nativa
      const doc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relatório de gestão — ${U.esc(label)}</title>
        <style>body{font-family:Segoe UI,system-ui,Arial,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#0f1b2d}.report{font-size:13px}.report header{border-bottom:2px solid #0f1b2d;margin-bottom:10px;padding-bottom:6px}.report h1{font-size:20px;margin:0}.report h2{font-size:14.5px;margin:18px 0 6px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}th{background:#e2e8f0;-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{page-break-inside:avoid}.tip{background:#eff6ff;border:1px solid #bfdbfe;padding:8px 12px;border-radius:8px}@media print{.tip{display:none}@page{size:A4;margin:14mm}}</style></head>
        <body>${native ? '' : '<p class="tip">Para gerar o PDF: use Imprimir (Ctrl+P ou Compartilhar → Imprimir no celular) e escolha “Salvar como PDF”.</p>'}${body}${native ? '' : `<script>window.addEventListener('load',function(){setTimeout(function(){try{window.print()}catch(e){}},300)})<\/script>`}</body></html>`;
      if (native) { Native.print(doc, `Relatorio-gestao-${from}-a-${to}`); UI.toast('Na impressão, escolha “Salvar como PDF”.'); return; }
      Cloud.save(`relatorio-gestao_${from}_${to}.html`, new Blob([doc], { type: 'text/html' }));
      UI.toast('Abra o relatório baixado e escolha “Salvar como PDF” na impressão.');
      return;
    }
    const root = document.getElementById('print-root');
    root.innerHTML = body;
    const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
    UI.toast('Na janela de impressão, escolha "Salvar como PDF".');
  },
};
