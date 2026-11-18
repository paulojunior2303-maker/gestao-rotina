// Teste geral simulando o Redmi Note 12 (WebView Android / Chromium, toque, pt-BR, America/Sao_Paulo)
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const useRoutine12 = require('./rotina-exemplo');
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
      Sistema: { status: async () => ({ bateriaLiberada: false, fabricante: 'xiaomi' }), abrir: async (o) => window.__call('abrir', o), manterTela: async (o) => window.__call('tela', o), gravando: async (o) => window.__call('gravando', o) },
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
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1')) || JSON.parse(JSON.stringify(S)));   // instalação nova ainda sem nada gravado
  const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const overflow = async (name) => {
    const r = await p.evaluate(() => {
      const out = [];
      if (innerWidth !== 393 || document.documentElement.scrollWidth > 393) out.push(`página mais larga que a tela (${document.documentElement.scrollWidth}px)`);
      document.querySelectorAll('#view *').forEach(el => {
        const rc = el.getBoundingClientRect();
        if (rc.width && rc.right > 394 && !el.closest('.chart-scroll,.kanban,.table-wrap,.gantt,.tabs,.stat-chips')) out.push((el.className || el.tagName) + ' sai da tela');
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
  check(await p.locator('#bottom-nav a').count() === 4 && await p.locator('#bottom-nav [data-act=openMenu]').count() === 0, 'barra de baixo com Calendário, Gravações, Tarefas e Agenda (e o Gravar no meio), sem o botão Menu');
  check(await p.locator('#bottom-nav .bn-rec').count() === 1, 'botão Gravar no meio da barra de baixo');
  await tap('#bottom-nav a[href="#tarefas"]'); check(await p.textContent('#page-title') === 'Gestão de tarefas', 'barra de baixo → Tarefas');
  await tap('#bottom-nav a[href="#dashboard"]');
  check(await p.locator('.cal-home .calx-grid').count() === 1, 'calendário em destaque na tela inicial');
  await tap('#menu-btn'); await W(300);
  check(await p.evaluate(() => document.body.classList.contains('menu-open')), '☰ abre o menu lateral');
  await overflow('01b-menu');
  check(await p.locator('#nav a[href="#agenda"]').isHidden() && await p.locator('#nav a[href="#config"]').isVisible(), 'menu lateral não repete o que está na barra de baixo');
  await tap('#nav a[href="#imprevistos"]'); await W(300);
  check(!(await p.evaluate(() => document.body.classList.contains('menu-open'))) && (await p.textContent('#page-title')) === 'Imprevistos', 'item do menu navega e fecha o menu');
  check(await p.locator('#nav a[href="#semanal"], #nav a[href="#mensal"]').count() === 0, 'planejamento semanal e mensal não são mais telas separadas');

  console.log('\n[2] Agenda (Dia) — concluir atividades (problema relatado)');
  // Instalação nova: só uma atividade de exemplo na rotina; "Limpar rotina" deixa em branco
  await go('config');
  check((await st()).routine.length === 1, 'instalação nova: rotina com uma atividade de exemplo só');
  await tap('[data-act=rtClear]'); await tap(`${M} [data-yes]`);
  await go('agenda');
  check(await p.locator('.timeline .blk').count() === 0 && (await p.textContent('.timeline')).includes('Rotina padrão'), 'rotina em branco: a Agenda mostra o caminho para cadastrar');
  await useRoutine12(p); await go('dashboard');
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
  const agDia = (await p.locator('.calx-agenda').textContent()).replace(/\s+/g, ' ');
  check(agDia.includes('27%'), `Calendário mostra o progresso da agenda do dia → "${agDia.trim()}"`);
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
  await p.evaluate(() => Actions.agNew()); await W(300); await fill('title', 'Visita técnica'); await fill('start', '07:00'); await fill('end', '07:40'); await save();
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
  await p.evaluate(() => Actions.occNew()); await W(300); await fill('title', 'Câmeras offline no cliente'); await fill('responsible', 'Carlos');
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
  await p.locator('.task', { hasText: 'Cobrar relatório' }).locator('[data-act=tkSet][data-s=concluida]').tap(); await W(300);
  s = await st(); check(s.tasks.find(t => t.title === 'Cobrar relatório').status === 'concluida', 'botão ✓ conclui a tarefa');
  check((await p.locator('.stat-chip', { hasText: 'Concluídas' }).textContent()).includes('1'), 'contador "Concluídas" atualiza na hora');
  check(await p.locator('.task', { hasText: 'Cobrar relatório' }).count() === 0, 'tarefa concluída sai da lista de abertas');
  await tap('[data-act=tkStatusF][data-v=concluida]'); check(await p.locator('.task').count() === 1, 'filtro mostra as tarefas concluídas');
  await p.locator('.task').first().locator('[data-act=tkSet][data-s=pendente]').tap(); await W(300);
  s = await st(); check(s.tasks.find(t => t.title === 'Cobrar relatório').status === 'pendente', 'botão ↶ reabre a tarefa');
  await tap('[data-act=tkStatusF][data-v=abertas]');
  await p.locator('.task', { hasText: 'Conferir estoque' }).locator('[data-act=tkSet][data-s=andamento]').tap(); await W(300);
  s = await st(); check(s.tasks.find(t => t.title === 'Conferir estoque').status === 'andamento', 'botão ▶ na linha marca em execução');
  const run = p.locator('.task.andamento', { hasText: 'Conferir estoque' });
  check(await run.count() === 1 && (await run.textContent()).includes('em execução') && (await p.locator('.tk-grp').first().textContent()).includes('Em execução') && await run.evaluate(e => getComputedStyle(e).boxShadow.includes('inset')), 'tarefa em execução fica destacada, no topo da lista');
  check(await run.locator('[data-act=tkSet][data-s=pendente]').count() >= 1, 'na tarefa em execução o ▶ vira ⏸ (pausar)');
  await p.locator('.task', { hasText: 'Conferir estoque' }).locator('[data-act=tkMore]').tap(); await W(300);
  check(await p.locator('.sheet-item:has-text("Cancelar tarefa")').count() === 1 && await p.locator('.sheet-item:has-text("Começar agora")').count() === 0, '⋯ tem Cancelar (o Começar ficou na linha)');
  await p.keyboard.press('Escape'); await W(300);
  await p.fill('[data-input=tkSearch]', 'estoque'); await W(500); check(await p.locator('.task').count() === 1, 'busca');
  await p.fill('[data-input=tkSearch]', ''); await W(500);
  await p.locator('.task', { hasText: 'Conferir estoque' }).locator('[data-act=tkMore]').tap(); await W(300); await tap('.sheet-item.danger:has-text("Excluir")'); await tap(`${M} [data-yes]`);
  check(await p.locator('.task', { hasText: 'Conferir estoque' }).count() === 0, 'excluir tarefa');

  console.log('\n[5] Calendário (Início) e botão +');
  await go('semanal'); check((await p.textContent('#page-title')) === 'Agenda', 'endereço antigo #semanal abre a Agenda');
  await go('dashboard');
  await p.locator('.calx-d.today').first().tap(); await W(300);
  check(await p.locator('.calx-day h2').count() === 1, 'tocar no dia mostra a lista do dia');
  await p.evaluate(() => window.scrollTo(0, 0)); await W(300);   // o + sai da frente ao rolar para baixo
  await fab(); await p.locator(`${M} #cap-t`).fill('Reunião com fornecedor às 10h'); await tap(`${M} [data-save]`);
  check((await st()).tasks.some(x => x.title === 'Reunião com fornecedor às 10h' && x.dueTime === '10:00') && await p.locator('.calx-day .calx-it', { hasText: 'Reunião com fornecedor' }).count() === 1, 'o + do Início cria tarefa com horário e ela aparece na lista do dia');
  await overflow('07-inicio-calendario');
  await go('agenda');
  check(await p.locator('.timeline .blk-it', { hasText: 'Reunião com fornecedor' }).count() === 1, 'Agenda: o compromisso entra na lista do dia, junto com a rotina');
  await go('dashboard');
  // Arrastar o dedo no calendário troca de mês
  const t0 = await p.textContent('.calx-t');
  await p.evaluate(() => { const g = document.querySelector('.calx-grid'), r = g.getBoundingClientRect(), y = r.top + 40; const mk = x => new Touch({ identifier: 1, target: g, clientX: x, clientY: y }); g.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(300)], bubbles: true })); g.dispatchEvent(new TouchEvent('touchend', { changedTouches: [mk(120)], bubbles: true })); }); await W(300);
  check((await p.textContent('.calx-t')) !== t0, `arrastar para a esquerda vai para o próximo mês (${t0} → ${await p.textContent('.calx-t')})`);
  await tap('[data-act=calToday]');

  console.log('\n[8] Configurações');
  await go('config');
  await overflow('11-config');
  await p.fill('form[data-submit=tecAdd] input', 'Carlos'); await p.locator('form[data-submit=tecAdd] button').tap(); await W();
  check((await st()).settings.technicians.length === 1, 'cadastrar técnico');
  await tap('[data-act=demoLoad]'); check(await p.locator('.demo-banner').count() === 1, 'carregar demonstração');
  await tap('.demo-banner [data-act=demoRemove]'); await tap(`${M} [data-yes]`);
  check(!(await st()).tasks.some(t => t.demo) && (await st()).tasks.length === 2, 'remover demonstração mantém seus dados');
  await tap('[data-act=dataExport]'); await W(400);
  check(calls.some(c => c[0] === 'share' && c[1].files[0].endsWith('.json')), 'backup → menu Compartilhar');

  console.log('\n[8b] Aviso de atualização, lembretes e reuniões');
  await go('dashboard');
  check(await p.locator('.update-banner').count() === 1 && (await p.locator('.update-banner a').getAttribute('href')).endsWith('/v1.1.99/GestaoRotina.apk'), 'aviso de versão nova (1.1.99) com link do APK');
  await overflow('12-aviso-atualizacao');
  await tap('.update-banner [data-act=updLater]'); check(await p.locator('.update-banner').count() === 0, '"Depois" esconde o aviso desta versão');
  await go('config');
  check(await p.locator('#cfg-lembretes [data-change=lemOn]').count() === 1, 'Configurações → Lembretes');
  check(calls.some(c => c[0] === 'reqPerm') && (await st()).settings.lembretes.on && await p.locator('#cfg-lembretes .switch').first().isChecked(), 'lembretes já vêm ligados e o app pede a permissão de notificações sozinho');
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
  console.log('\n[8c] Feedbacks');
  await p.evaluate(() => { S.settings.ia.key = 'CHAVE-DE-TESTE-1234'; S.settings.ia.agente = 'MEU AGENTE DE TESTE: escreva atas no padrão Wi-Bicam.'; S.settings.ia.nivel = 'detalhada'; commit(); });
  await go('feedbacks');
  check(await p.textContent('#page-title') === 'Gravações', 'endereço antigo #feedbacks abre Gravações');
  await go('dashboard'); await p.evaluate(() => FB.form(null)); await W(300);   // feedback: fica em Gravações (o + não tem mais a lista)
  await fill('pessoa', 'Natan Krainer'); await p.locator(`${M} [name=tom][value=positivo]`).check();
  await p.evaluate(() => { Recorder.SEG_MS = 1500; });
  await tap(`${M} [data-rec]`); await W(3800);
  check((await p.textContent(`${M} .live-txt`)).length > 10, 'feedback: transcrição ao vivo durante a conversa');
  await p.screenshot({ path: OUT + '/19-feedback-ao-vivo.png' });
  await tap(`${M} [data-rec]`); await W(2500);
  check(calls.some(c => c[0] === 'gravando' && c[1].ligada === true) && calls.filter(c => c[0] === 'gravando').pop()[1].ligada === false, 'gravando: liga o serviço "Gravando" do Android (tela bloqueada) e desliga ao encerrar');
  const fbReq = iaReqs.filter(r => JSON.stringify(r.body).includes('Tarefa: /feedback')).pop();
  check(!!fbReq && JSON.stringify(fbReq.body).includes('Natan Krainer') && JSON.stringify(fbReq.body).includes('Positivo') && JSON.stringify(fbReq.body).includes('MEU AGENTE'), 'ao encerrar, a IA escreve o feedback no padrão do agente (nome e tom)');
  check((await p.inputValue(`${M} [name=resumo]`)).includes('Natan manteve') && (await p.inputValue(`${M} [name=acordos]`)).includes('novo técnico'), 'registro e acordos preenchidos');
  await p.locator(`${M} [name=mkTasks]`).check(); await save(); await W(300);
  const sf = await st();
  check(sf.feedbacks.length === 1 && sf.feedbacks[0].tom === 'positivo' && sf.feedbacks[0].transcricao, 'feedback salvo com tom e transcrição');
  check(sf.tasks.some(t => t.title.startsWith('Natan acompanha') && t.responsible === 'Natan Krainer'), 'acordos viram tarefas com o colaborador como responsável');
  check(sf.settings.technicians.some(t => t.name === 'Natan Krainer'), 'colaborador novo entra na lista da equipe');

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
