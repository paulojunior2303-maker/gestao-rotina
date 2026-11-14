const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
require('./completo');
// meta.updatedAt muda ao importar (é uma alteração local, que sobe para o Google Drive): compara o resto
const norm = j => { const o = JSON.parse(j); if (o.meta) delete o.meta.updatedAt; return JSON.stringify(o); };
let pass = 0, fail = 0; const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };
const phone = { viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' };
(async () => {
  const b = await chromium.launch();
  const shared = [];
  // ---------- APK (Capacitor simulado) ----------
  const ctxA = await b.newContext({ ...phone, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctxA.exposeBinding('__share', (_, o) => { shared.push(o); });
  await ctxA.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { App: { addListener: () => {}, exitApp: () => {} },
      Filesystem: { writeFile: async () => ({ uri: 'file:///x' }), readFile: async () => { throw new Error('nf'); } },
      Share: { share: async (o) => { await window.__share(o); return {}; } }, Printer: { print: async () => {} } } };
  });
  const a = await ctxA.newPage(); const errs = []; a.on('pageerror', e => errs.push('APK: ' + e.message));
  await a.goto('http://localhost:8765/android-app/www/index.html'); await a.waitForTimeout(700);
  await a.locator('[data-tour=skip]').tap(); await a.waitForTimeout(300);
  // dados "reais" volumosos: demo + 120 dias de agenda + 300 lançamentos
  await a.evaluate(() => {
    Store.loadDemo();
    S.tasks.push({ id: 'minha', title: 'Minha tarefa real', status: 'pendente', priority: 'alta', category: 'equipe', createdAt: new Date().toISOString(), dueDate: '2026-11-20' });
    for (let i = 0; i < 120; i++) { const k = U.addDays(U.today(), -i); if (D.isWorkday(k)) { D.ensureDay(k).forEach((b, j) => { if (j % 2) b.status = 'concluida'; }); } }
    for (let i = 0; i < 300; i++) S.indicators.push({ id: 'r' + i, date: U.addDays(U.today(), -(i % 120)), technician: 'Carlos', notes: '', values: { osRecebidas: i % 7, osConcluidas: i % 5, osPendentes: null, osAtrasadas: null, pontosCamera: i % 9, manutencoes: i % 3, retrabalhos: i % 2 } });
    commit();
  });
  const snapA = await a.evaluate(() => JSON.stringify(S));
  console.log('[APK → Enviar meus dados]');
  await a.evaluate(() => location.hash = '#config'); await a.waitForTimeout(300);
  await a.locator('[data-act=xferOut]').tap(); await a.waitForTimeout(700);
  const code = await a.locator('.modal-wrap.open .code-box').inputValue();
  const kb = Math.round(code.length / 1024);
  check(code.startsWith('GR1:'), `código comprimido gerado (${kb} KB para ${Math.round(snapA.length / 1024)} KB de dados)`);
  await a.locator('.modal-wrap.open [data-copy]').tap(); await a.waitForTimeout(300);
  const clip = await a.evaluate(() => navigator.clipboard.readText());
  check(clip === code, 'botão Copiar código coloca o código na área de transferência');
  await a.locator('.modal-wrap.open [data-share]').tap(); await a.waitForTimeout(300);
  check(shared.length === 1 && shared[0].text === code, 'botão Enviar código abre o compartilhar do Android com o texto');
  await a.screenshot({ path: OUT + '/xfer-apk.png' });

  // ---------- Web (GitHub Pages / navegador) ----------
  console.log('[Web → Receber dados]');
  const ctxW = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'pt-BR' });
  const w = await ctxW.newPage(); w.on('pageerror', e => errs.push('WEB: ' + e.message));
  await w.goto('http://localhost:8765/index.html'); await w.waitForTimeout(700);
  await w.locator('[data-tour=skip]').click(); await w.waitForTimeout(300);
  await w.evaluate(() => location.hash = '#config'); await w.waitForTimeout(300);
  await w.locator('[data-act=xferIn]').click(); await w.waitForTimeout(300);
  await w.fill('.modal-wrap.open .code-box', code.slice(0, code.length - 200)); await w.locator('.modal-wrap.open [data-go]').click(); await w.waitForTimeout(400);
  check((await w.locator('.modal-wrap.open .form-error').textContent()).includes('incompleto'), 'código cortado → mensagem clara de "incompleto"');
  // simula código colado com quebras de linha e texto ao redor (como vem do WhatsApp)
  const messy = 'Meus dados:\n' + code.replace(/(.{500})/g, '$1\n') + '\n';
  await w.fill('.modal-wrap.open .code-box', messy); await w.locator('.modal-wrap.open [data-go]').click(); await w.waitForTimeout(500);
  const confirmTxt = await w.locator('.modal-wrap.open .confirm-msg').textContent();
  check(confirmTxt.includes('5 tarefas') && confirmTxt.includes('2 projetos'), `confirmação mostra o resumo: "${confirmTxt.match(/\d+ tarefas[^.]*/)[0]}"`);
  await w.locator('.modal-wrap.open [data-yes]').click(); await w.waitForTimeout(500);
  const snapW = await w.evaluate(() => JSON.stringify(S));
  check(norm(snapW) === norm(snapA), 'dados na web idênticos aos do APK (código com quebras de linha e texto extra)');
  await w.evaluate(() => location.hash = '#tarefas'); await w.waitForTimeout(300);
  check(await w.locator('.task', { hasText: 'Minha tarefa real' }).count() === 1, 'tarefa aparece na web');
  await w.reload(); await w.waitForTimeout(600); await w.evaluate(() => location.hash = '#tarefas'); await w.waitForTimeout(300);
  check(await w.locator('.task', { hasText: 'Minha tarefa real' }).count() === 1, 'continua lá após recarregar');

  // arquivo sem extensão/tipo .json (como vem do WhatsApp/Drive)
  console.log('[Arquivo de backup sem tipo reconhecido]');
  await w.evaluate(() => { localStorage.clear(); }); await w.reload(); await w.waitForTimeout(600);
  if (await w.locator('[data-tour=skip]').count()) { await w.locator('[data-tour=skip]').click(); await w.waitForTimeout(300); }
  await w.evaluate(() => location.hash = '#config'); await w.waitForTimeout(300);
  check(await w.locator('input[data-change=dataImport]').getAttribute('accept') === null, 'seletor de arquivo não filtra mais por tipo');
  await w.setInputFiles('input[data-change=dataImport]', { name: 'backup-gestao-rotina (1).bin', mimeType: 'application/octet-stream', buffer: Buffer.from(snapA) });
  await w.waitForTimeout(500);
  await w.locator('.modal-wrap.open [data-yes]').click(); await w.waitForTimeout(400);
  check(norm(await w.evaluate(() => JSON.stringify(S))) === norm(snapA), 'importa backup mesmo com tipo de arquivo desconhecido');
  await w.setInputFiles('input[data-change=dataImport]', { name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([255, 216, 255, 0, 1]) });
  await w.waitForTimeout(400);
  check((await w.locator('.toast').last().textContent()).includes('Não é um backup'), 'arquivo errado → aviso claro, nada é alterado');

  // ---------- Link do Claude (nuvem simulada) ----------
  console.log('[Link do Claude → Receber dados]');
  const store = {};
  const ctxC = await b.newContext({ ...phone });
  await ctxC.exposeBinding('__dbGet', (_, col) => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.slice(col.length + 1), data: v })));
  await ctxC.exposeBinding('__dbSet', (_, path, data) => { store[path] = data; });
  await ctxC.exposeBinding('__dbDel', (_, path) => { delete store[path]; });
  await ctxC.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });
    const db = { collection: (col) => ({ get: async () => { const rows = await window.__dbGet(col); return { empty: !rows.length, docs: rows.map(r => ({ id: r.id, exists: true, data: () => r.data })) }; },
      doc: (id) => ({ set: (d) => window.__dbSet(col + '/' + id, JSON.parse(JSON.stringify(d))), delete: () => window.__dbDel(col + '/' + id) }) }) };
    window.claude = { use: (n) => new Promise(r => setTimeout(() => r({ db, user: { id: async () => 'u1' }, downloads: null }[n] || null), 200)) };
  });
  const c = await ctxC.newPage(); c.on('pageerror', e => errs.push('CLAUDE: ' + e.message));
  await c.goto('http://localhost:8765/dist/gestao-rotina.html'); await c.waitForTimeout(1200);
  await c.locator('[data-tour=skip]').tap(); await c.waitForTimeout(800);
  await c.evaluate(() => location.hash = '#config'); await c.waitForTimeout(300);
  await c.locator('[data-act=xferIn]').tap(); await c.waitForTimeout(300);
  await c.fill('.modal-wrap.open .code-box', code); await c.locator('.modal-wrap.open [data-go]').tap(); await c.waitForTimeout(500);
  await c.locator('.modal-wrap.open [data-yes]').tap(); await c.waitForTimeout(1500);
  const docs = Object.keys(store).filter(k => k.startsWith('data/users/u1/'));
  check(store['data/users/u1/tasks'] && store['data/users/u1/tasks'].items.some(t => t.title === 'Minha tarefa real'), `dados importados e salvos na conta (${docs.length} documentos)`);
  const biggest = Math.max(...docs.map(k => JSON.stringify(store[k]).length));
  check(biggest < 256 * 1024, `nenhum documento passa do limite de 256 KB (maior: ${Math.round(biggest / 1024)} KB)`);
  await c.screenshot({ path: OUT + '/xfer-claude.png' });

  check(!errs.length, 'sem erros de JavaScript ' + errs.join(' | '));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
