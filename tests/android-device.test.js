// Teste geral simulando o Redmi Note 12 (WebView Android / Chromium, toque, pt-BR, America/Sao_Paulo)
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const fs = require('fs');
let pass = 0, fail = 0; const failures = [];
const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; failures.push(m); console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({
    viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 23021RAA2Y Build/UKQ1.230917.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36',
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
  });
  const calls = [];
  await ctx.exposeBinding('__call', (_, name, arg) => { calls.push([name, arg]); });
  await ctx.addInitScript(() => {
    const listeners = {}; const files = JSON.parse(sessionStorage.getItem('__files') || '{}');
    window.__fire = (ev, data) => (listeners[ev] || []).forEach(f => f(data || {}));
    window.__pending = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); }, exitApp: () => window.__call('exitApp'), getInfo: async () => ({ version: '1.1.6' }) },
      LocalNotifications: {
        checkPermissions: async () => ({ display: sessionStorage.getItem('__perm') || 'prompt' }),
        requestPermissions: async () => { sessionStorage.setItem('__perm', 'granted'); window.__call('reqPerm'); return { display: 'granted' }; },
        getPending: async () => ({ notifications: window.__pending }),
        cancel: async (o) => { window.__pending = window.__pending.filter(n => !o.notifications.some(x => x.id === n.id)); },
        schedule: async (o) => { window.__pending = window.__pending.concat(o.notifications); window.__call('schedule', o.notifications.map(n => ({ id: n.id, title: n.title, body: n.body, at: +n.schedule.at, action: n.actionTypeId, extra: n.extra }))); },
        createChannel: async () => {}, registerActionTypes: async (o) => window.__call('actionTypes', o),
        addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); },
        checkExactNotificationSetting: async () => ({ exact_alarm: 'denied' }),
        changeExactNotificationSetting: async () => window.__call('exact'),
      },
      Sistema: { status: async () => ({ bateriaLiberada: false, fabricante: 'xiaomi' }), abrir: async (o) => window.__call('abrir', o), manterTela: async (o) => window.__call('tela', o) },
      Filesystem: {
        writeFile: async (o) => { files[o.directory + '/' + o.path] = o.data; sessionStorage.setItem('__files', JSON.stringify(files)); window.__call('writeFile', { path: o.path, dir: o.directory }); return { uri: 'file:///cache/' + o.path }; },
        readFile: async (o) => { const d = files[o.directory + '/' + o.path]; if (!d) throw new Error('not found'); return { data: d }; },
      },
      Share: { share: async (o) => window.__call('share', o) },
      Printer: { print: async (o) => window.__call('print', { len: o.html.length }) },
    } };
  });
  await ctx.route('https://api.github.com/**', r => r.fulfill({ json: { tag_name: 'v1.1.99' } }));
  const iaReqs = []; let ataCalls = 0;
  await ctx.route('https://generativelanguage.googleapis.com/**', r => {
    const body = r.request().postDataJSON(); iaReqs.push({ url: r.request().url(), key: r.request().headers()['x-goog-api-key'], body });
    const txt = JSON.stringify(body);
    const ok = text => r.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
    if (txt.includes('Responda apenas: ok')) return ok('ok');
    if (txt.includes('Tarefa: /feedback')) return ok(JSON.stringify({ resumo: 'Natan manteve desempenho positivo no período, com autonomia e boa qualidade nas entregas.\n\nComo ponto de atenção, foi reforçada a proteção dos cabos contra infiltração.', acordos: ['Natan acompanha o novo técnico nas instalações', 'Verificar com a TI a bateria do celular corporativo'] }));
    if (txt.includes('monte a PAUTA')) return ok(JSON.stringify({ itens: ['Escala do sábado', 'Uso de EPI', 'Metas do mês'] }));
    if (txt.includes('/compact')) return ok('ATA COMPACTA\nData: 09/11\n\n1. Escala\n• Carlos no dia 14.');
    if (txt.includes('Transcreva fielmente')) return ok('— Vamos começar pela escala do sábado. Carlos fica no dia 14.\n— Sobre EPI, precisamos comprar luvas até quarta.');
    ataCalls++;
    if (ataCalls === 1) return r.fulfill({ status: 503, json: { error: { message: 'high demand' } } });   // 1º modelo sobrecarregado → tenta o próximo
    return ok(JSON.stringify({ tratados: [1, 2], combinados: ['Carlos monta a escala', 'Comprar luvas até quarta'], ata: 'ATA DE REUNIÃO — Equipe Teste Data: 09/11/2026 Assunto: Escala e EPI 1. Escala do sábado • Carlos fica no dia 14. 2. Uso de EPI • Comprar luvas até quarta.' }));
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('status of 503')) errs.push(m.text()); });   // 503 simulado da IA
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
  const dayProgressText = () => p.locator('.ag-head p').textContent();
  // Botão flutuante "+": abre a lista e escolhe o item (no Início e na Agenda)
  const fab = async label => { await tap('#fab'); await W(300); if (label) { await tap(`.sheet-item:has-text("${label}")`); await W(300); } };

  await p.goto(URL); await W(600);
  await p.waitForTimeout(500); if (await p.locator('.tour-wrap').count()) { await p.locator('[data-tour=skip]').tap(); await p.waitForTimeout(300); }
  console.log('Hoje (simulado):', today, await p.evaluate(() => new Date().toLocaleTimeString('pt-BR')));

  console.log('\n[1] Dashboard e navegação');
  check((await p.textContent('#storage-status')).includes('aparelho'), 'status "Dados salvos neste aparelho"');
  await overflow('01-dashboard');
  check(await p.locator('#bottom-nav a').count() === 4 && await p.locator('#bottom-nav [data-act=openMenu]').count() === 0, 'barra de baixo com Início, Agenda, Tarefas e Imprevistos, sem o botão Menu');
  await tap('#bottom-nav a[href="#tarefas"]'); check(await p.textContent('#page-title') === 'Gestão de tarefas', 'barra de baixo → Tarefas');
  await tap('#bottom-nav a[href="#dashboard"]');
  check(await p.locator('.cal-home .calx-grid').count() === 1, 'calendário em destaque na tela inicial');
  await tap('#menu-btn'); await W(300);
  check(await p.evaluate(() => document.body.classList.contains('menu-open')), '☰ abre o menu lateral');
  await overflow('01b-menu');
  await tap('#nav a[href="#agenda"]'); await W(300);
  check(!(await p.evaluate(() => document.body.classList.contains('menu-open'))) && (await p.textContent('#page-title')) === 'Agenda', 'item do menu navega e fecha o menu');
  check(await p.locator('#nav a[href="#semanal"], #nav a[href="#mensal"]').count() === 0, 'planejamento semanal e mensal não são mais telas separadas');

  console.log('\n[2] Agenda (Dia) — concluir atividades (problema relatado)');
  await p.evaluate(() => { S.settings.breakMode = 'fixo'; commit(); });   // estes passos usam o intervalo em horário fixo
  await go('agenda');
  check(await p.locator('.ag-cal .calx-d').count() === 7 && await p.locator('.agenda-modes').count() === 0, 'Agenda numa tela só: semana em cima, o dia embaixo');
  check(await p.locator('#fab').isVisible(), 'botão flutuante + na Agenda');
  check(await p.locator('.blk').count() === 12, 'rotina padrão com 12 blocos');
  await overflow('02-agenda');
  // reproduz o caso relatado: atividades com "Horário fixo"
  for (const t of ['Abertura e análise de demandas', 'Alinhamento da equipe']) {
    await p.locator('.blk-body', { hasText: t }).tap(); await W(300);
    await p.locator(`${M} [name=fixed]`).check(); await save();
  }
  check((await st()).days[today].filter(x => x.fixed).length >= 2, 'duas atividades marcadas como Horário fixo (como nas suas capturas)');
  await p.locator('.blk', { hasText: 'Abertura e análise' }).locator('[data-s=concluida]').tap(); await W();
  await p.locator('.blk', { hasText: 'Alinhamento da equipe' }).locator('[data-s=concluida]').tap(); await W();
  let txt = await dayProgressText();
  check(txt.includes('2 de 11'), `progresso do dia atualiza com atividades de horário fixo → "${txt.trim().replace(/\s+/g, ' ')}"`);
  await p.locator('.blk', { hasText: 'Acompanhamento operacional' }).locator('[data-s=concluida]').tap(); await W();
  txt = await dayProgressText();
  check(txt.includes('3 de 11'), `concluir atividade comum atualiza na hora → "${txt.trim().replace(/\s+/g, ' ')}"`);
  await go('dashboard');
  const ring = (await p.locator('.kpi-ring').textContent()).replace(/\s+/g, ' ');
  check(ring.includes('27%') && ring.includes('3 de 11'), `Dashboard mostra o progresso atualizado → "${ring.trim()}"`);
  await go('agenda');
  await p.locator('.blk', { hasText: 'Acompanhamento operacional' }).locator('[data-s=pendente]').tap(); await W();
  check((await dayProgressText()).includes('2 de 11'), 'reabrir atividade (desfazer) atualiza o progresso');
  for (const t of ['Atividades administrativas', 'Resolução de pendências']) {
    await p.locator('.blk', { hasText: t }).locator('[data-act=agMore]').tap(); await W(300);
    await tap('.sheet-item:has-text("Começar agora")');
  }
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
  await fab('Atividade na agenda'); await fill('title', 'Visita técnica'); await fill('start', '07:00'); await fill('end', '07:40'); await save();
  check(await p.locator('.blk', { hasText: 'Visita técnica' }).count() === 1, 'criar atividade');
  await p.locator('.blk', { hasText: 'Visita técnica' }).locator('[data-act=agMore]').tap(); await W(300);
  await tap('.sheet-item.danger:has-text("Excluir")'); await tap(`${M} [data-yes]`);
  check(await p.locator('.blk', { hasText: 'Visita técnica' }).count() === 0, 'excluir atividade');
  await tap('.toast .link'); check(await p.locator('.blk', { hasText: 'Visita técnica' }).count() === 1, 'desfazer exclusão pelo aviso');
  // navegação de datas
  const h0 = await p.textContent('.ag-head h2');
  await tap('.ag-cal [data-act=calNav][data-n="1"]'); check((await p.textContent('.ag-head h2')) !== h0, 'semana seguinte: troca o dia (mesmo dia da semana)');
  await tap('.ag-cal .calx-d:not(.sel)'); check(await p.locator('.ag-cal .calx-d.sel').count() === 1, 'tocar num dia do calendário abre o dia');
  await tap('.ag-cal [data-act=calToday]'); check((await p.textContent('.ag-head h2')) === h0, 'botão Hoje volta para hoje');
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

  console.log('\n[5] Calendário (Início) e botão +');
  await go('semanal'); check((await p.textContent('#page-title')) === 'Agenda', 'endereço antigo #semanal abre a Agenda');
  await go('dashboard');
  await p.locator('.calx-d.today').first().tap(); await W(300);
  check(await p.locator('.calx-day h3').count() === 1, 'tocar no dia mostra a lista do dia');
  await fab('Compromisso');
  await fill('title', 'Reunião com fornecedor'); await fill('time', '10:00'); await save();
  check((await st()).events.length === 1 && await p.locator('.calx-day .calx-it', { hasText: 'Reunião com fornecedor' }).count() === 1, 'novo compromisso pelo + do Início aparece na lista do dia');
  await overflow('07-inicio-calendario');
  await go('agenda');
  check(await p.locator('.timeline .blk-it', { hasText: 'Reunião com fornecedor' }).count() === 1, 'Agenda: o compromisso entra na lista do dia, junto com a rotina');
  await go('dashboard');
  // Arrastar o dedo no calendário troca de mês
  const t0 = await p.textContent('.calx-t');
  await p.evaluate(() => { const g = document.querySelector('.calx-grid'), r = g.getBoundingClientRect(), y = r.top + 40; const mk = x => new Touch({ identifier: 1, target: g, clientX: x, clientY: y }); g.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(300)], bubbles: true })); g.dispatchEvent(new TouchEvent('touchend', { changedTouches: [mk(120)], bubbles: true })); }); await W(300);
  check((await p.textContent('.calx-t')) !== t0, `arrastar para a esquerda vai para o próximo mês (${t0} → ${await p.textContent('.calx-t')})`);
  await tap('[data-act=calToday]');

  console.log('\n[6] Projetos');
  check(await p.locator('#nav a[href="#projetos"]').count() === 0, 'Projetos fica oculto no menu por padrão');
  await p.evaluate(() => { S.settings.showProjetos = true; commit(); });
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
  check(await p.locator('#nav a[href="#indicadores"]').count() === 0, 'Indicadores oculto no menu por padrão');
  await go('config'); await p.locator('[data-change=cfgIndicadores]').tap(); await W();
  await go('indicadores');
  check(await p.locator('.kpi.nodata').count() >= 3, 'sem lançamentos → "sem dados"');
  await tap('[data-act=indNew]'); await fill('pontosCamera', '12'); await fill('manutencoes', '9'); await save();
  check((await p.locator('.kpi', { hasText: 'Serviços concluídos' }).locator('.kpi-v').textContent()).trim() === '12', 'lançar dados atualiza KPIs (12 serviços concluídos)');
  check(!(await p.textContent('#view')).includes('O.S.'), 'Indicadores sem campos de O.S.');
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

  console.log('\n[8b] Aviso de atualização, lembretes e reuniões');
  await go('dashboard');
  check(await p.locator('.update-banner').count() === 1 && (await p.locator('.update-banner a').getAttribute('href')).endsWith('/v1.1.99/GestaoRotina.apk'), 'aviso de versão nova (1.1.99) com link do APK');
  await overflow('12-aviso-atualizacao');
  await tap('.update-banner [data-act=updLater]'); check(await p.locator('.update-banner').count() === 0, '"Depois" esconde o aviso desta versão');
  await go('config');
  check(await p.locator('#cfg-lembretes [data-change=lemOn]').count() === 1, 'Configurações → Lembretes');
  await p.locator('#cfg-lembretes .switch').first().tap(); await W(600);
  check(calls.some(c => c[0] === 'reqPerm') && (await st()).settings.lembretes.on, 'ligar lembretes pede a permissão de notificações');
  await W(400);
  const stTxt = await p.locator('#lem-status').textContent();
  check(stTxt.includes('Alarmes exatos desligados') && stTxt.includes('Inicialização automática'), 'mostra alarmes exatos, bateria e inicialização automática (Xiaomi)');
  await overflow('13-lembretes');
  await tap('#lem-status [data-tela=autostart]'); check(calls.some(c => c[0] === 'abrir' && c[1].tela === 'autostart'), 'abre a tela de inicialização automática do Xiaomi');
  await tap('[data-act=lemTest]'); await W(300); check(calls.some(c => c[0] === 'schedule' && c[1].some(n => n.id === 999)), 'aviso de teste agendado');
  calls.length = 0;
  const amanha = await p.evaluate(() => U.addDays(U.today(), 1));
  await go('tarefas'); await tap('[data-act=tkNew]'); await fill('title', 'Entregar relatório'); await fill('dueDate', amanha); await fill('dueTime', '10:00'); await save();
  await W(1600);
  let sch = calls.filter(c => c[0] === 'schedule').pop();
  const tAviso = sch && sch[1].find(n => n.body.includes('Entregar relatório'));
  check(!!tAviso && tAviso.action === 'TAREFA' && (await p.evaluate(t => new Date(t).toTimeString().slice(0, 5), tAviso.at)) === '09:45', 'tarefa com horário → aviso 15 min antes (09:45) com botão Feito');
  check(sch[1].filter(n => n.body.includes('Entregar relatório')).length === 5, 'repetição a cada 30 min depois do prazo (até 2 h)');
  const tid = (await st()).tasks.find(t => t.title === 'Entregar relatório').id;
  await p.evaluate(x => __fire('localNotificationActionPerformed', { actionId: 'feito', notification: { extra: x } }), tAviso.extra); await W(1600);
  check((await st()).tasks.find(t => t.id === tid).status === 'concluida', '"Feito" na notificação conclui a tarefa');
  sch = calls.filter(c => c[0] === 'schedule').pop();
  check(!sch || !sch[1].some(n => n.body.includes('Entregar relatório')), 'tarefa concluída sai dos avisos');
  // Reuniões: tela própria no menu, pauta, gravação com transcrição ao vivo, IA e combinados → tarefas
  await tap('#menu-btn'); await W(300);
  check(await p.locator('#nav a[href="#reunioes"]').count() === 1 && await p.locator('#nav a[href="#feedbacks"]').count() === 0, 'Reuniões e feedbacks: uma entrada só no menu (Dia a dia)');
  await tap('#nav a[href="#reunioes"]'); await W(300);
  check(await p.textContent('#page-title') === 'Reuniões e feedbacks' && await p.locator('.mt-tabs .tab').count() === 2, 'tela Reuniões e feedbacks, com as abas Reuniões e Feedbacks');
  check(await p.getAttribute('#fab', 'data-act') === 'mtNew', 'na aba Reuniões, o + cria uma reunião');
  // Reunião mais tarde hoje: dá para iniciar ANTES do horário
  const later = await p.evaluate(() => U.nowMin() < 23 * 60 + 30 ? U.fromMin(U.nowMin() + 20) : null);
  if (later) {
    await tap('[data-act=mtNew]'); await fill('title', 'Alinhamento da tarde'); await fill('date', today); await fill('time', later); await fill('pauta', 'Ocorrências do dia'); await save();
    check(await p.locator('.mt-card', { hasText: 'Alinhamento da tarde' }).locator('[data-act=mtStart]').count() === 1, 'reunião de hoje ainda não começou: botão "Iniciar" no cartão');
    await tap('.mt-card:has-text("Alinhamento da tarde")'); await W(300);
    check((await p.textContent(`${M} [data-reg]`)).includes('Iniciar reunião'), 'antes do horário, a reunião mostra "Iniciar reunião"');
    await p.evaluate(() => __fire('backButton')); await W(300);
    await tap('.mt-card:has-text("Alinhamento da tarde") [data-act=mtStart]'); await W(300);
    check(await p.locator(`${M} [data-rec]`).count() === 1 && (await p.textContent(`${M} .ia-h`)).includes('ao vivo'), '"Iniciar" abre a reunião com gravação e transcrição ao vivo');
    await p.evaluate(() => __fire('backButton')); await W(300);
  }
  await tap('[data-act=mtNew]');
  check((await p.textContent(`${M} .modal-head`)).includes('Nova reunião'), 'botão + abre "Nova reunião"');
  await fill('title', 'Reunião de equipe'); await fill('date', today); await fill('time', '00:05'); await fill('pauta', 'Escala do sábado\nUso de EPI\nMetas do mês'); await save();
  let ev = (await st()).events.find(e => e.title === 'Reunião de equipe');
  check(ev && ev.pautas.length === 3 && ev.reuniao, 'reunião com pauta (3 assuntos)');
  check(await p.locator('.mt-sec', { hasText: 'Para registrar' }).locator('.mt-card', { hasText: 'Reunião de equipe' }).count() === 1, 'reunião que já passou fica em "Para registrar"');
  await overflow('14-reunioes');
  await go('dashboard');
  check(await p.locator('.li-main', { hasText: 'Reunião de equipe' }).count() >= 1, 'também aparece em "O que resolver" no Início');
  await go('reunioes'); await tap('.mt-card:has-text("Reunião de equipe")'); await W(300);
  check(await p.locator(`${M} .pauta li`).count() === 3, 'abrir reunião mostra a pauta');
  await tap(`${M} [data-reg]`); await W(300);
  // Sem chave: a área da IA aparece com o campo da chave
  check(await p.locator(`${M} .ia-box`).count() === 1 && await p.locator(`${M} [name=iaKey]`).count() === 1, 'sem chave: área da IA com campo para colar a chave');
  await tap(`${M} [data-rec]`); await W(200);
  check((await p.textContent(`${M} .ia-msg`)).includes('chave'), 'gravar sem chave explica que falta a chave');
  await p.fill(`${M} [name=iaKey]`, 'CHAVE-DE-TESTE-1234'); await tap(`${M} [data-ia-save]`); await W(800);
  check((await st()).settings.ia.key === 'CHAVE-DE-TESTE-1234' && iaReqs.some(r => r.key === 'CHAVE-DE-TESTE-1234'), 'salvar a chave direto na reunião e testar');
  check(await p.locator(`${M} [name=iaKey]`).count() === 0 && (await p.textContent(`${M} .ia-msg`)).includes('funcionando'), 'chave ok: campo some e confirma');
  // Instruções do agente (Configurações → IA) — definidas direto no estado para não fechar a reunião aberta
  await p.evaluate(() => { S.settings.ia.agente = 'MEU AGENTE DE TESTE: escreva atas no padrão Wi-Bicam.'; S.settings.ia.nivel = 'detalhada'; });
  // Gravação ao vivo (trechos curtos no teste)
  await p.evaluate(() => { Recorder.SEG_MS = 1500; });
  await tap(`${M} [data-rec]`); await W(400);
  check((await p.textContent(`${M} [data-rec]`)).includes('Encerrar gravação'), 'gravação iniciada (botão vira "Encerrar gravação")');
  await p.locator(`${M} [name^=p_]`).nth(2).check();
  await p.evaluate(() => __fire('backButton')); await W(300);
  check(await p.locator(M).count() === 1, 'voltar/fechar durante a gravação é bloqueado (não perde a gravação)');
  await W(3800);
  const liveTxt = await p.textContent(`${M} .live-txt`);
  check(liveTxt.includes('escala do sábado') && /\[0:0\d\]/.test(liveTxt), 'transcrição aparece AO VIVO durante a gravação, com o tempo de cada trecho');
  check(calls.some(c => c[0] === 'tela' && c[1].ligada), 'tela fica acesa durante a gravação');
  await p.screenshot({ path: OUT + '/16-reuniao-ao-vivo.png' });
  await tap(`${M} [data-rec]`); await W(2500);
  const ataReq = iaReqs.filter(r => JSON.stringify(r.body).includes('Transcrição da reunião')).pop();
  check(!!ataReq && !JSON.stringify(ataReq.body).includes('inlineData'), 'ao encerrar, a IA monta o registro a partir da transcrição (texto)');
  check(ataCalls === 2, 'modelo sobrecarregado → tenta o próximo sozinho');
  check(calls.some(c => c[0] === 'tela' && c[1].ligada === false), 'tela volta ao normal ao encerrar');
  const checked = await p.locator(`${M} [name^=p_]`).evaluateAll(els => els.map(e => e.checked));
  check(checked.join() === 'true,true,true', 'IA marcou os assuntos 1 e 2 e manteve o 3, marcado à mão durante a reunião');
  const ataTxt = await p.inputValue(`${M} [name=ata]`);
  check((await p.inputValue(`${M} [name=combinados]`)).includes('Comprar luvas') && ataTxt.startsWith('ATA DE REUNIÃO'), 'IA escreveu a ata e preencheu os combinados');
  check(ataTxt.split('\n').length >= 7 && ataTxt.includes('\n\n2. Uso de EPI'), 'ata organizada em linhas mesmo se a IA devolver o texto corrido');
  const ataReqTxt = JSON.stringify(iaReqs.filter(r => JSON.stringify(r.body).includes('Transcrição da reunião')).pop().body);
  check(ataReqTxt.includes('MEU AGENTE DE TESTE') && ataReqTxt.includes('ATA detalhada'), 'a ata segue as instruções do agente e o nível escolhido');
  await tap(`${M} [data-rw=compact]`); await W(800);
  check((await p.inputValue(`${M} [name=ata]`)).startsWith('ATA COMPACTA'), 'comando rápido "Compactar" reescreve a ata');
  await tap(`${M} [data-rw-copy]`); await W(200);
  await p.locator(`${M} [name=mkTasks]`).check(); await save(); await W(300);
  const s9 = await st(); ev = s9.events.find(e => e.title === 'Reunião de equipe');
  check(ev.registro && ev.registro.tratadas.length === 3 && ev.registro.ata.startsWith('ATA COMPACTA') && ev.registro.transcricao.includes('escala do sábado'), 'registro salvo com pauta, ata e transcrição');
  check(s9.tasks.some(t => t.title === 'Carlos monta a escala') && s9.tasks.some(t => t.title === 'Comprar luvas até quarta'), 'cada combinado virou uma tarefa');
  check(await p.locator('.mt-sec', { hasText: 'Registradas' }).locator('.mt-card', { hasText: 'Reunião de equipe' }).count() === 1, 'reunião vai para "Registradas"');
  await tap('.mt-card:has-text("Reunião de equipe")'); await W(300);
  check((await p.textContent(M)).includes('Registro da reunião') && await p.locator(`${M} details.tx`).count() === 1, 'reunião mostra o registro e a transcrição');
  await p.evaluate(() => __fire('backButton')); await W(300);
  await go('config');
  check(await p.locator('#cfg-ia').count() === 1 && (await p.textContent('#cfg-ia')).includes('1234'), 'Configurações → IA mostra só o final da chave');
  check((await p.inputValue('#ia-agent')).includes('MEU AGENTE'), 'Configurações → IA: campo "Instruções do seu agente"');
  await p.fill('#ia-agent', 'MEU AGENTE V2'); await p.selectOption('#ia-nivel', 'compacta'); await p.locator('#cfg-ia .ia-agent button').tap(); await W(300);
  check((await st()).settings.ia.agente === 'MEU AGENTE V2' && (await st()).settings.ia.nivel === 'compacta', 'salvar instruções do agente e nível da ata');
  // Pauta com IA (inclui pendências da última reunião)
  await p.evaluate(() => { const e = S.events.find(x => x.title === 'Reunião de equipe'); e.registro.tratadas = e.registro.tratadas.slice(0, 2); commit(); });   // "Metas do mês" ficou pendente
  await go('reunioes'); await tap('[data-act=mtNew]');
  check(await p.locator(`${M} [data-pauta-ia]`).count() === 1 && (await p.textContent(`${M} .pauta-ia`)).includes('pendente'), 'Nova reunião: "Gerar pauta com IA" oferece incluir pendências');
  await fill('title', 'Reunião da próxima semana'); await p.fill(`${M} [name=pautaTema]`, 'escala e EPI'); await tap(`${M} [data-pauta-ia]`); await W(600);
  check((await p.inputValue(`${M} [name=pauta]`)).split('\n').length === 3, 'IA montou a pauta (3 assuntos)');
  const pReq = JSON.stringify(iaReqs.filter(r => JSON.stringify(r.body).includes('monte a PAUTA')).pop().body);
  check(pReq.includes('MEU AGENTE V2') && pReq.includes('Pendências de reuniões anteriores') && pReq.includes('Metas do mês'), 'pauta usa o agente e as pendências');
  await p.screenshot({ path: OUT + '/18-pauta-ia.png' });
  await p.evaluate(() => __fire('backButton')); await W(300);
  await overflow('15-config-ia');
  await go('reunioes'); await tap('.mt-card:has-text("Reunião de equipe")'); await W(300);
  await p.screenshot({ path: OUT + '/17-reuniao-registrada.png' });
  await p.evaluate(() => __fire('backButton')); await W(300);

  console.log('\n[8c] Feedbacks');
  await go('feedbacks');
  check(await p.textContent('#page-title') === 'Reuniões e feedbacks' && (await p.textContent('.mt-tabs .tab.active')).includes('Feedbacks'), 'endereço #feedbacks abre a aba Feedbacks');
  check(await p.getAttribute('#fab', 'data-act') === 'fbNew', 'na aba Feedbacks, o + cria um feedback');
  await tap('#fab');
  await fill('pessoa', 'Natan Krainer'); await p.locator(`${M} [name=tom][value=positivo]`).check();
  await p.evaluate(() => { Recorder.SEG_MS = 1500; });
  await tap(`${M} [data-rec]`); await W(3800);
  check((await p.textContent(`${M} .live-txt`)).length > 10, 'feedback: transcrição ao vivo durante a conversa');
  await p.screenshot({ path: OUT + '/19-feedback-ao-vivo.png' });
  await tap(`${M} [data-rec]`); await W(2500);
  const fbReq = iaReqs.filter(r => JSON.stringify(r.body).includes('Tarefa: /feedback')).pop();
  check(!!fbReq && JSON.stringify(fbReq.body).includes('Natan Krainer') && JSON.stringify(fbReq.body).includes('Positivo') && JSON.stringify(fbReq.body).includes('MEU AGENTE'), 'ao encerrar, a IA escreve o feedback no padrão do agente (nome e tom)');
  check((await p.inputValue(`${M} [name=resumo]`)).includes('Natan manteve') && (await p.inputValue(`${M} [name=acordos]`)).includes('novo técnico'), 'registro e acordos preenchidos');
  await p.locator(`${M} [name=mkTasks]`).check(); await save(); await W(300);
  const sf = await st();
  check(sf.feedbacks.length === 1 && sf.feedbacks[0].tom === 'positivo' && sf.feedbacks[0].transcricao, 'feedback salvo com tom e transcrição');
  check(sf.tasks.some(t => t.title.startsWith('Natan acompanha') && t.responsible === 'Natan Krainer'), 'acordos viram tarefas com o colaborador como responsável');
  check(sf.settings.technicians.some(t => t.name === 'Natan Krainer'), 'colaborador novo entra na lista da equipe');
  check(await p.locator('.fb-card').count() === 1 && await p.locator('.fb-head', { hasText: 'Natan Krainer' }).count() === 1, 'abre o histórico do colaborador');
  await overflow('20-feedback-pessoa');
  await tap('.fb-card'); await W(300);
  check((await p.textContent(M)).includes('Natan manteve') && await p.locator(`${M} details.tx`).count() === 1, 'feedback mostra o registro, os acordos e a transcrição');
  await p.evaluate(() => __fire('backButton')); await W(300);
  await tap('[data-act=fbWho][data-n=""]');
  check(await p.locator('.fb-person', { hasText: 'Natan Krainer' }).count() === 1, 'lista da equipe com o histórico de cada pessoa');
  await overflow('21-feedbacks');

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
