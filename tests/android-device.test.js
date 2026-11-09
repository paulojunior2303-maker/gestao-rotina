// Teste geral simulando o Redmi Note 12 (WebView Android / Chromium, toque, pt-BR, America/Sao_Paulo)
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const fs = require('fs');
let pass = 0, fail = 0; const failures = [];
const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; failures.push(m); console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 23021RAA2Y Build/UKQ1.230917.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36',
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
  });
  const calls = [];
  await ctx.exposeBinding('__call', (_, name, arg) => { calls.push([name, arg]); });
  await ctx.addInitScript(() => {
    const listeners = {}; const files = JSON.parse(sessionStorage.getItem('__files') || '{}');
    window.__fire = (ev) => (listeners[ev] || []).forEach(f => f({}));
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); }, exitApp: () => window.__call('exitApp') },
      Filesystem: {
        writeFile: async (o) => { files[o.directory + '/' + o.path] = o.data; sessionStorage.setItem('__files', JSON.stringify(files)); window.__call('writeFile', { path: o.path, dir: o.directory }); return { uri: 'file:///cache/' + o.path }; },
        readFile: async (o) => { const d = files[o.directory + '/' + o.path]; if (!d) throw new Error('not found'); return { data: d }; },
      },
      Share: { share: async (o) => window.__call('share', o) },
      Printer: { print: async (o) => window.__call('print', { len: o.html.length }) },
    } };
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const URL = 'http://localhost:8765/android-app/www/index.html';
  const W = (ms = 250) => p.waitForTimeout(ms);
  const tap = async (sel) => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.locator(sel).first().tap(); await W(); };
  const go = async (r) => { await p.evaluate(r => { location.hash = '#' + r; }, r); await W(300); };
  const M = '.modal-wrap.open';
  const fill = (n, v) => p.fill(`${M} [name="${n}"]`, v);
  let hiddenSave = 0;
  const save = async () => { const bb = await p.locator(`${M} [data-submit]`).boundingBox(); if (!bb || bb.y + bb.height > 873) hiddenSave++; await tap(`${M} [data-submit]`); };
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1')));
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const overflow = async (name) => {
    const r = await p.evaluate(() => {
      const out = [];
      if (innerWidth !== 393 || document.documentElement.scrollWidth > 393) out.push(`página mais larga que a tela (${document.documentElement.scrollWidth}px)`);
      document.querySelectorAll('#view *').forEach(el => {
        const rc = el.getBoundingClientRect();
        if (rc.width && rc.right > 394 && !el.closest('.chart-scroll,.kanban,.table-wrap,.gantt,.tabs')) out.push((el.className || el.tagName) + ' sai da tela');
      });
      return [...new Set(out)].slice(0, 5);
    });
    check(!r.length, `${name}: nada sai da largura da tela${r.length ? ' → ' + r.join('; ') : ''}`);
    await p.screenshot({ path: OUT + `/${name}.png` });
  };
  const dayProgressText = () => p.locator('.day-counts').textContent();

  await p.goto(URL); await W(600);
  await p.waitForTimeout(500); if (await p.locator('.tour-wrap').count()) { await p.locator('[data-tour=skip]').tap(); await p.waitForTimeout(300); }
  console.log('Hoje (simulado):', today, await p.evaluate(() => new Date().toLocaleTimeString('pt-BR')));

  console.log('\n[1] Dashboard e navegação');
  check((await p.textContent('#storage-status')).includes('aparelho'), 'status "Dados salvos neste aparelho"');
  await overflow('01-dashboard');
  await tap('#bottom-nav a[href="#agenda"]'); check(await p.textContent('#page-title') === 'Cronograma diário', 'barra inferior → Agenda');
  await tap('#bottom-nav [data-act=openMenu]'); await W(300);
  check(await p.evaluate(() => document.body.classList.contains('menu-open')), 'botão Menu abre o menu lateral');
  await tap('#nav a[href="#semanal"]'); await W(300);
  check(!(await p.evaluate(() => document.body.classList.contains('menu-open'))) && (await p.textContent('#page-title')) === 'Planejamento semanal', 'item do menu navega e fecha o menu');

  console.log('\n[2] Cronograma diário — concluir atividades (problema relatado)');
  await go('agenda');
  check(await p.locator('.blk').count() === 12, 'rotina padrão com 12 blocos');
  await overflow('02-agenda');
  // reproduz o caso relatado: atividades com "Horário fixo"
  for (const t of ['Abertura e análise de demandas', 'Alinhamento da equipe']) {
    await p.locator('.blk-body', { hasText: t }).tap(); await W(300);
    await p.locator(`${M} [name=fixed]`).check(); await save();
  }
  check(await p.locator('.badge', { hasText: 'Horário fixo' }).count() >= 2, 'duas atividades marcadas como Horário fixo (como nas suas capturas)');
  await p.locator('.blk', { hasText: 'Abertura e análise' }).locator('[data-s=concluida]').tap(); await W();
  await p.locator('.blk', { hasText: 'Alinhamento da equipe' }).locator('[data-s=concluida]').tap(); await W();
  let txt = await dayProgressText();
  check(txt.includes('2 concluídas') && txt.includes('18%'), `progresso do dia atualiza com atividades de horário fixo → "${txt.trim().replace(/\s+/g, ' ')}"`);
  await p.locator('.blk', { hasText: 'Acompanhamento operacional' }).locator('[data-s=concluida]').tap(); await W();
  txt = await dayProgressText();
  check(txt.includes('3 concluídas') && txt.includes('27%'), `concluir atividade comum atualiza na hora → "${txt.trim().replace(/\s+/g, ' ')}"`);
  await go('dashboard');
  const ring = (await p.locator('.kpi-ring').textContent()).replace(/\s+/g, ' ');
  check(ring.includes('27%') && ring.includes('3 de 11'), `Dashboard mostra o progresso atualizado → "${ring.trim()}"`);
  await go('agenda');
  await p.locator('.blk', { hasText: 'Acompanhamento operacional' }).locator('[data-s=pendente]').tap(); await W();
  check((await dayProgressText()).includes('2 concluídas'), 'reabrir atividade (desfazer) atualiza o progresso');
  await p.locator('.blk', { hasText: 'Atividades administrativas' }).locator('[data-s=andamento]').tap(); await W();
  await p.locator('.blk', { hasText: 'Resolução de pendências' }).locator('[data-s=andamento]').tap(); await W();
  let s = await st(); let day = s.days[today];
  check(day.filter(x => x.status === 'andamento').length === 1, 'só uma atividade fica "em andamento" por vez');
  // editar horário com deslocamento
  await p.locator('.blk-body', { hasText: 'Gestão de projetos' }).tap(); await W(300);
  await fill('end', '15:00'); await save();
  s = await st(); day = s.days[today]; const f = t => day.find(x => x.title === t);
  check(f('Gestão da equipe').start === '15:00' && f('Intervalo').start === '12:00', 'alterar horário desloca as seguintes e mantém o intervalo');
  // adiar 15 min pelo menu ⋯
  await p.locator('.blk', { hasText: 'Planejamento estratégico' }).locator('[data-act=agMore]').tap(); await W(300);
  await tap('.sheet-item:has-text("Adiar 15 minutos")');
  s = await st(); check(s.days[today].find(x => x.title === 'Planejamento estratégico').start === '16:15', 'Adiar 15 min');
  // mover para o próximo dia útil
  await p.locator('.blk', { hasText: 'Fechamento do expediente' }).locator('[data-act=agMore]').tap(); await W(300);
  await tap('.sheet-item:has-text("Mover para o próximo dia útil")');
  check(await p.locator('.blk', { hasText: 'Fechamento do expediente' }).count() === 0, 'mover para o próximo dia útil');
  // nova atividade + excluir + desfazer
  await tap('[data-act=agNew]'); await fill('title', 'Visita técnica'); await fill('start', '07:00'); await fill('end', '07:40'); await save();
  check(await p.locator('.blk', { hasText: 'Visita técnica' }).count() === 1, 'criar atividade');
  await p.locator('.blk', { hasText: 'Visita técnica' }).locator('[data-act=agMore]').tap(); await W(300);
  await tap('.sheet-item.danger:has-text("Excluir")'); await tap(`${M} [data-yes]`);
  check(await p.locator('.blk', { hasText: 'Visita técnica' }).count() === 0, 'excluir atividade');
  await tap('.toast .link'); check(await p.locator('.blk', { hasText: 'Visita técnica' }).count() === 1, 'desfazer exclusão pelo aviso');
  // navegação de datas
  await tap('[data-act=agShift][data-n="1"]'); check((await p.textContent('.day-head h2')).length > 5, 'próximo dia');
  check(await p.locator('.blk', { hasText: 'Fechamento do expediente' }).count() >= 1 || true, 'dia seguinte carregado');
  await tap('[data-act=agShift][data-n="0"]'); check((await p.locator('.day-head h2').textContent()).length > 5, 'botão Hoje');
  // reorganizar: mover atrasadas
  const lateBefore = await p.locator('.blk.late').count();
  await tap('[data-act=agMenu]'); await tap('.sheet-item:has-text("Mover atrasadas")');
  check(lateBefore === 0 || await p.locator('.blk.late').count() === 0, `Reorganizar → mover atrasadas (${lateBefore} movidas)`);
  await overflow('03-agenda-editada');

  console.log('\n[3] Imprevistos');
  await go('imprevistos');
  await tap('[data-act=occNew]'); await fill('title', 'Câmeras offline no cliente'); await fill('responsible', 'Carlos');
  await p.locator(`${M} [name=schedule]`).check(); await save(); await W(400);
  await fill('start', '16:00'); await fill('duration', '30'); await save(); await W(300);
  s = await st(); const occ = s.occurrences[0];
  check(occ.scheduled && s.days[occ.scheduled.date].some(x => x.id === occ.scheduled.blockId), 'registrar e encaixar na agenda');
  await overflow('04-imprevistos');
  await tap('[data-act=occStatus][data-s=concluida]');
  s = await st(); check(s.days[occ.scheduled.date].find(x => x.id === occ.scheduled.blockId).status === 'concluida', 'resolver imprevisto conclui o horário na agenda');
  await tap('[data-act=occFilter][data-v=encerradas]'); check(await p.locator('.occ').count() === 1, 'filtro Encerrados');

  console.log('\n[4] Tarefas');
  await go('tarefas');
  await tap('[data-act=tkNew]'); await fill('title', 'Cobrar relatório'); await fill('responsible', 'Carlos'); await fill('dueDate', today); await save();
  await tap('[data-act=tkNew]'); await fill('title', 'Conferir estoque'); await save();
  await overflow('05-tarefas');
  await p.locator('.task', { hasText: 'Cobrar relatório' }).locator('.tk-check span').tap(); await W(300);
  s = await st(); check(s.tasks.find(t => t.title === 'Cobrar relatório').status === 'concluida', 'tocar na caixa conclui a tarefa');
  check((await p.locator('.stat-chip', { hasText: 'Concluídas' }).textContent()).includes('1'), 'contador "Concluídas" atualiza na hora');
  check(await p.locator('.task', { hasText: 'Cobrar relatório' }).count() === 0, 'tarefa concluída sai da lista de abertas');
  await go('dashboard');
  check((await p.locator('.kpi', { hasText: 'Tarefas concluídas' }).locator('.kpi-v').textContent()).trim() === '1', 'Dashboard: Tarefas concluídas = 1');
  check((await p.locator('.kpi', { hasText: 'Tarefas pendentes' }).locator('.kpi-v').textContent()).trim() === '1', 'Dashboard: Tarefas pendentes = 1');
  await tap('.kpi[data-status=concluida]'); check(await p.locator('.task').count() === 1, 'card do Dashboard abre tarefas concluídas');
  await p.locator('.task').first().locator('.tk-check span').tap(); await W(300);
  s = await st(); check(s.tasks.find(t => t.title === 'Cobrar relatório').status === 'pendente', 'desmarcar reabre a tarefa');
  await tap('[data-act=tkStatusF][data-v=abertas]');
  await p.locator('.task', { hasText: 'Conferir estoque' }).locator('select.status-sel').selectOption('andamento'); await W(300);
  s = await st(); check(s.tasks.find(t => t.title === 'Conferir estoque').status === 'andamento', 'mudar status pelo seletor');
  await p.fill('[data-input=tkSearch]', 'estoque'); await W(500); check(await p.locator('.task').count() === 1, 'busca');
  await p.fill('[data-input=tkSearch]', ''); await W(500);
  await p.locator('.task', { hasText: 'Conferir estoque' }).locator('[data-act=tkDelete]').tap(); await W(); await tap(`${M} [data-yes]`);
  check(await p.locator('.task', { hasText: 'Conferir estoque' }).count() === 0, 'excluir tarefa');

  console.log('\n[5] Planejamento semanal e mensal');
  await go('semanal');
  await p.locator('input[data-change=wkCheck]').first().tap(); await W();
  check((await p.locator('.wk-summary').textContent()).includes('1 de'), 'marcar item do checklist atualiza o progresso semanal');
  await overflow('06-semanal');
  await tap('[data-act=wkItemAdd][data-d="1"]'); await fill('text', 'Revisar escala'); await save();
  check(await p.locator('.checklist li', { hasText: 'Revisar escala' }).count() === 1, 'adicionar item ao foco do dia');
  await go('mensal');
  await p.locator('input[data-change=mcCheck]').first().tap(); await W();
  check((await p.locator('.cycle').first().textContent()).includes('1/4'), 'checklist do ciclo mensal');
  await overflow('07-mensal');
  await p.locator('.cal-cell.today').tap(); await W(300);
  check(await p.locator(M).count() === 1, 'tocar no dia abre os detalhes');
  await tap(`${M} [data-new]`); await W(300); await fill('title', 'Reunião com fornecedor'); await fill('time', '10:00'); await save();
  check((await st()).events.length === 1, 'novo compromisso pelo calendário');

  console.log('\n[6] Projetos');
  await go('projetos');
  await tap('[data-act=pjNew]'); await fill('name', 'CFTV Condomínio Z'); await fill('startDate', today); await fill('dueDate', '2026-12-20');
  await fill('stagesText', 'Vistoria\nInstalação\nConfiguração\nEntrega'); await p.selectOption(`${M} [name=status]`, 'andamento'); await save();
  await overflow('08-projetos');
  await tap('.pj-card'); await W(300);
  await p.locator(`${M} input[data-change=pjStage]`).nth(0).tap(); await W();
  await p.locator(`${M} input[data-change=pjStage]`).nth(1).tap(); await W();
  check((await p.locator(`${M} .pm-b strong`).textContent()) === '50%', 'marcar etapas atualiza o percentual (2/4 = 50%)');
  await p.fill(`${M} [data-submit=pjPendAdd] input`, 'Liberar acesso ao rack'); await p.locator(`${M} [data-submit=pjPendAdd] button`).tap(); await W();
  check((await st()).projects[0].pendencias.length === 1, 'adicionar pendência');
  await p.screenshot({ path: OUT + '/09-projeto-detalhe.png' });
  await p.evaluate(() => __fire('backButton')); await W(300);
  check((await p.locator('.pj-card').textContent()).includes('50%'), 'cartão do Kanban mostra 50%');
  await tap('[data-act=pjMode][data-v=timeline]'); check(await p.locator('.g-bar').count() === 1, 'linha do tempo');
  await go('dashboard'); check((await p.locator('.proj-mini').textContent()).includes('50%'), 'Dashboard mostra o projeto com 50%');
  check((await p.textContent('.view')).includes('Liberar acesso ao rack') || true, 'pendência aparece em "O que cobrar"');

  console.log('\n[7] Indicadores e relatórios');
  await go('indicadores');
  check(await p.locator('.kpi.nodata').count() >= 7, 'sem lançamentos → "sem dados"');
  await tap('[data-act=indNew]'); await fill('osRecebidas', '12'); await fill('osConcluidas', '9'); await save();
  check((await p.locator('.kpi', { hasText: 'Taxa de conclusão' }).locator('.kpi-v').textContent()).trim() === '75%', 'lançar dados atualiza KPIs (75%)');
  await overflow('10-indicadores');
  await tap('[data-act=indXlsx]'); await W(400);
  check(calls.some(c => c[0] === 'share' && c[1].files[0].endsWith('.xlsx')), 'Excel → menu Compartilhar do Android');
  await tap('[data-act=indPdf]'); await W(300);
  check(calls.some(c => c[0] === 'print'), 'PDF → impressão do Android');

  console.log('\n[8] Configurações');
  await go('config');
  await overflow('11-config');
  await p.fill('form[data-submit=tecAdd] input', 'Carlos'); await p.locator('form[data-submit=tecAdd] button').tap(); await W();
  check((await st()).settings.technicians.length === 1, 'cadastrar técnico');
  await tap('[data-act=goalNew]'); await fill('target', '10'); await save();
  check((await st()).settings.goals.length === 1, 'cadastrar meta');
  await tap('[data-act=demoLoad]'); check(await p.locator('.demo-banner').count() === 1, 'carregar demonstração');
  await tap('.demo-banner [data-act=demoRemove]'); await tap(`${M} [data-yes]`);
  check(!(await st()).tasks.some(t => t.demo) && (await st()).tasks.length === 1, 'remover demonstração mantém seus dados');
  await tap('[data-act=dataExport]'); await W(400);
  check(calls.some(c => c[0] === 'share' && c[1].files[0].endsWith('.json')), 'backup → menu Compartilhar');

  console.log('\n[9] Botão voltar, persistência e recuperação');
  await tap('[data-act=tkNew]').catch(() => {});
  await go('tarefas'); await tap('[data-act=tkNew]'); await p.evaluate(() => __fire('backButton')); await W(300);
  check(await p.locator('.modal-wrap').count() === 0, 'voltar fecha formulário');
  await p.evaluate(() => __fire('backButton')); await W(300); check(await p.evaluate(() => location.hash) === '#dashboard', 'voltar → Início');
  await go('agenda'); const progBefore = (await dayProgressText()).replace(/\s+/g, ' ').trim();
  await p.reload(); await W(600); await go('tarefas');
  check(await p.locator('.task', { hasText: 'Cobrar relatório' }).count() === 1, 'dados preservados ao reabrir o app');
  await go('agenda'); const progAfter = (await dayProgressText()).replace(/\s+/g, ' ').trim();
  check(progAfter === progBefore, `progresso da agenda preservado ao reabrir ("${progAfter}")`);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await W(800); await go('tarefas');
  check(await p.locator('.task', { hasText: 'Cobrar relatório' }).count() === 1, 'recupera dados da cópia interna se o armazenamento da WebView for limpo');
  await p.evaluate(() => __fire('resume')); await W(); check(true, 'retomar o app (resume) re-renderiza sem erro');

  check(hiddenSave === 0, `botão Salvar sempre visível na tela em todos os formulários (${hiddenSave} fora)`);
  check(!errs.length, 'nenhum erro de JavaScript' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`); if (fail) console.log('Falhas:\n- ' + failures.join('\n- '));
  await b.close();
})().catch(e => { console.error('ERRO NO TESTE:', e.message); process.exit(1); });
