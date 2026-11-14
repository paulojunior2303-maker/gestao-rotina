// Cópia enxuta (dist/gestao-rotina-enxuto.html): calendário do mês + gravar com um toque.
// Microfone falso do Chromium, IA simulada, partes de 3 s (no app são 10 min), queda de internet e app fechado no meio.
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', permissions: ['microphone'] });
  let tr = 0; const ia = { ata: 0, fb: 0 };
  await ctx.route('https://generativelanguage.googleapis.com/**', r => {
    const txt = JSON.stringify(r.request().postDataJSON());
    const ok = text => r.fulfill({ json: { candidates: [{ content: { parts: [{ text }] } }] } });
    if (txt.includes('Transcreva fielmente')) { tr++; return ok(`— Trecho ${tr}: falamos da escala do sábado e da compra de luvas.`); }
    if (txt.includes('Tarefa: /feedback')) { ia.fb++; return ok(JSON.stringify({ resumo: 'Carlos teve boa evolução nas entregas.\n\nAcordos:\n• Carlos revisa os conectores.', acordos: ['Carlos revisa os conectores do bloco B'] })); }
    if (txt.includes('Tarefa: /ata')) { ia.ata++; return ok(JSON.stringify({ tratados: [], combinados: ['Carlos monta a escala do sábado', 'Comprar luvas até quarta'], ata: 'ATA DE REUNIÃO\nData: 11/11/2026\n\n1. Escala do sábado\n• Carlos fica no dia 14.' })); }
    return ok('ok');
  });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept().catch(() => {}));
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  const W = (ms = 250) => p.waitForTimeout(ms);
  const M = '.modal-wrap.open';
  const tap = async sel => { await p.locator(sel).first().tap(); await W(); };
  const go = async r => { await p.evaluate(r => { location.hash = '#' + r; }, r); await W(); };
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1:enxuto')));
  const rapido = () => p.evaluate(() => { Gravador.SEG_MS = 3000; Gravador.SLICE_MS = 500; });
  const espera = async (fn, ms = 20000, msg = '', arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await W(300); } throw new Error('FALHOU (tempo esgotado): ' + msg); };
  const fits = async n => { const w = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, ...[...document.querySelectorAll('.modal-wrap.open .modal')].map(m => m.scrollWidth))); check(w <= 393, `${n}: cabe em 393 px (${w}px)`); };
  const URL = 'http://localhost:8765/dist/gestao-rotina-enxuto.html';
  await p.goto(URL); await W(600);
  await rapido();
  await p.evaluate(() => { S.settings.ia.key = 'chave-de-teste'; S.settings.technicians = [{ id: 't1', name: 'Carlos Souza' }]; commit(); });

  console.log('\n[1] Telas enxutas');
  check(await p.locator('.teste-tag', { hasText: 'ENXUTO' }).count() === 1, 'marca ENXUTO no topo (dados separados)');
  check(await p.locator('.cal-home .calx-month').count() === 1 || await p.locator('.cal-home .calx-grid .calx-d').count() >= 28, 'Início é o calendário do mês inteiro');
  check(await p.locator('.gv-rec-big').count() === 1, 'botão grande "Gravar reunião ou feedback"');
  check(await p.locator('#bottom-nav > *').count() === 5 && await p.locator('#bottom-nav .bn-rec').count() === 1, 'barra de baixo: Calendário, Gravações, Gravar, Tarefas, Agenda');
  const menu = await p.$$eval('#nav a', as => as.map(a => a.getAttribute('href')));
  check(!menu.some(h => /jornada|indicadores|projetos|equipe|checklists|pessoas|semana|reunioes/.test(h)) && menu.length === 7, `menu enxuto (${menu.length} telas): ${menu.join(' ')}`);
  await go('jornada'); check(await p.locator('.gv-rec-big').count() === 1, 'telas retiradas voltam para o calendário');
  check(await p.locator('.jg-card').count() === 0, 'sem cartão do jogo');
  await p.screenshot({ path: OUT + '/enxuto-1-calendario.png' }); await fits('Calendário');

  console.log('\n[2] Gravar com um toque');
  await tap('#bottom-nav .bn-rec');
  check(await p.locator(`${M} .gv-clock`).count() === 1, 'um toque já começa a gravar (sem criar reunião antes)');
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 3, 15000, 'três partes');
  await espera(() => Gravador.cur.g.partes.filter(p => p.st === 'ok').length >= 2, 15000, 'partes transcritas durante a gravação');
  check(true, 'partes fechadas e transcritas enquanto grava');
  await p.screenshot({ path: OUT + '/enxuto-2-gravando.png' }); await fits('Gravando');
  await tap(`${M} [data-min]`);
  check(await p.locator('.gv-bar').count() === 1 && await p.locator('#bottom-nav .bn-rec.on').count() === 1, 'dá para usar o app gravando (barra vermelha e botão com o tempo)');
  await tap('.gv-bar');
  await tap(`${M} [data-stop]`); await W(800);
  check(await p.locator(`${M} h2`, { hasText: 'Gravação salva' }).count() === 1, 'ao encerrar, pergunta o que foi (dá para deixar para depois)');
  await p.screenshot({ path: OUT + '/enxuto-3-descrever.png' });
  await p.locator(`${M} .btn`, { hasText: 'Descrever depois' }).tap(); await W();
  await espera(() => S.gravacoes[0].status === 'pronta', 20000, 'resumo pronto');
  let s = await st(); let g = s.gravacoes[0];
  check(g.partes.every(x => x.st === 'ok') && g.resumo.startsWith('ATA DE REUNIÃO') && g.combinados.length === 2, `transcrição completa (${g.partes.length} partes) e resumo no fim`);
  const ev = s.events.find(e => e.gravacaoId === g.id);
  check(ev && ev.reuniao && ev.registro.ata.includes('Escala') && ev.registro.transcricao.includes('Trecho 1'), 'reunião criada com resumo e transcrição');
  const nAudio = await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), g.id);
  check(nAudio === g.partes.length, `áudio guardado no aparelho (${nAudio} partes)`);
  await go('dashboard');
  check(await p.locator('.calx-day .calx-it.t-gravacao').count() === 1 && await p.locator('.calx-day .calx-it.t-reuniao').count() === 0, 'a gravação aparece no dia do calendário (sem repetir a reunião)');
  check(await p.locator('.gv-att-it', { hasText: 'Descrever' }).count() === 1, 'lembra de descrever a gravação');
  await tap('.calx-day .calx-it.t-gravacao');
  check(await p.locator('.ata.pre', { hasText: 'Escala do sábado' }).count() === 1, 'detalhe com o resumo');
  await p.locator('.gv-tx summary').tap(); await W(400);
  check((await p.textContent('.gv-tx-body')).includes('[0:00]'), 'transcrição completa com o tempo de cada parte');
  check(await p.locator('.gv-part audio').count() === g.partes.length, 'dá para ouvir cada parte do áudio');
  await p.screenshot({ path: OUT + '/enxuto-4-detalhe.png', fullPage: true }); await fits('Detalhe');
  await tap('[data-act=gvTasks]');
  s = await st();
  check(s.tasks.filter(x => x.description && x.description.includes('Combinado da reunião')).length === 2, 'combinados viram tarefas');

  console.log('\n[3] Descrever depois como feedback');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));   // aviso por cima da barra
  await tap('#bottom-nav a[href="#gravacoes"]');
  check(await p.locator('.gv-card').count() === 1, 'tocar em Gravações de novo volta para a lista');
  await tap('.gv-card');
  await tap('[data-act=gvDesc]');
  await p.locator(`${M} input[name=tipo][value=feedback]`).check(); await W(150);
  await p.locator(`${M} [name=pessoa]`).fill('Carlos Souza');
  await tap(`${M} [data-submit]`);
  await espera(() => S.gravacoes[0].status === 'pronta' && S.gravacoes[0].ref && S.gravacoes[0].ref.kind === 'fb', 15000, 'resumo refeito como feedback');
  s = await st(); g = s.gravacoes[0];
  check(ia.fb === 1 && s.feedbacks.some(f => f.gravacaoId === g.id && f.pessoa === 'Carlos Souza' && f.resumo.includes('boa evolução')), 'vira feedback do Carlos (resumo refeito no padrão de feedback)');
  check(!s.events.some(e => e.gravacaoId === g.id), 'a reunião provisória sai');

  console.log('\n[4] Sem internet: o áudio espera e transcreve quando volta');
  const tr0 = tr;
  await ctx.setOffline(true);
  await go('dashboard'); await tap('.gv-rec-big');
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 2, 10000, 'gravando sem internet');
  await tap(`${M} [data-stop]`); await W(800);
  await p.locator(`${M} .btn`, { hasText: 'Descrever depois' }).tap(); await W(600);
  s = await st(); g = s.gravacoes.find(x => x.id !== s.gravacoes[0].id) || s.gravacoes[1];
  g = s.gravacoes.sort((a, c) => c.at.localeCompare(a.at))[0];
  check(g.status === 'pendente' && /internet/i.test(g.motivo) && tr === tr0, 'sem internet: fica esperando, com o motivo');
  check(await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), g.id) >= 2, 'o áudio está guardado no aparelho');
  await go('gravacoes');
  check(await p.locator('.alert', { hasText: 'esperando' }).count() === 1, 'a tela avisa o que está esperando');
  await ctx.setOffline(false);
  await espera(id => S.gravacoes.find(x => x.id === id).status === 'pronta', 20000, 'transcreveu sozinho quando a internet voltou', g.id);
  check(true, 'internet voltou: transcreveu e resumiu sozinho');

  console.log('\n[5] App fechou no meio da gravação');
  await go('dashboard'); await tap('.gv-rec-big');
  await espera(() => Gravador.cur && Gravador.cur.g.partes.length >= 2, 10000, 'segunda parte começando');
  await W(1600);   // pedaços da parte em andamento já salvos
  const gid = await p.evaluate(() => Gravador.cur.g.id);
  await p.reload(); await W(800); await rapido();
  await espera(id => { const g = S.gravacoes.find(x => x.id === id); return g && g.recuperada && g.status === 'pronta'; }, 20000, 'gravação recuperada e processada', gid);
  s = await st(); g = s.gravacoes.find(x => x.id === gid);
  const partesAudio = await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), gid);
  check(g.partes.length >= 2 && partesAudio === g.partes.filter(x => x.st !== 'perdida').length && g.partes.filter(x => x.st === 'ok').length >= 2, `nada se perdeu: ${partesAudio} partes recuperadas, incluindo a que estava gravando`);
  check(await p.evaluate(id => AudioDB.all('pedacos', [id]).then(l => l.length), gid) === 0, 'pedaços soltos foram juntados');

  console.log('\n[6] Apagar o áudio só quando quiser');
  await go('gravacoes'); await p.evaluate(() => { App.ui.gvId = null; App.render(); }); await p.locator('.gv-card').first().tap(); await W(400);
  await tap('[data-act=gvDelAudio]'); await tap(`${M} [data-yes]`); await W(400);
  const g6 = await p.evaluate(() => S.gravacoes.find(x => x.id === App.ui.gvId));
  check(!g6.audio && await p.evaluate(id => AudioDB.all('partes', [id]).then(l => l.length), g6.id) === 0 && (await p.textContent('.view')).includes('O áudio foi apagado'), '"Apagar o áudio" tira só o áudio; transcrição e resumo ficam');

  check(!errs.length, 'sem erros no console' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
