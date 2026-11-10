// Canal de teste (site …/teste/): marca TESTE, dados separados do oficial e Google Drive desligado
const { chromium } = require('playwright');
let pass = 0, fail = 0; const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  // 1) Oficial com uma tarefa
  await p.goto('http://localhost:8765/dist/gestao-rotina.html'); await p.waitForTimeout(500);
  await p.locator('[data-tour=skip]').tap(); await p.waitForTimeout(300);
  await p.evaluate(() => { S.tasks.push({ id: 'real1', title: 'Tarefa REAL', status: 'pendente', priority: 'media', category: 'administrativo', createdAt: new Date().toISOString() }); commit(); });
  check(await p.locator('.teste-tag').count() === 0, 'oficial: sem a marca TESTE');
  // 2) Teste no mesmo navegador (mesmo endereço do site)
  await p.goto('http://localhost:8765/dist/gestao-rotina-teste.html'); await p.waitForTimeout(500);
  check(await p.locator('.teste-tag').count() === 1 && (await p.title()).includes('TESTE'), 'teste: marca TESTE no topo e no título');
  if (await p.locator('[data-tour=skip]').count()) { await p.locator('[data-tour=skip]').tap(); await p.waitForTimeout(300); }
  check(!(await p.evaluate(() => S.tasks.some(t => t.title === 'Tarefa REAL'))), 'teste começa com dados próprios (não vê os reais)');
  await p.evaluate(() => { S.tasks.push({ id: 't1', title: 'Tarefa de TESTE', status: 'pendente', priority: 'media', category: 'administrativo', createdAt: new Date().toISOString() }); commit(); });
  const real = await p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1')));
  check(real.tasks.some(t => t.title === 'Tarefa REAL') && !real.tasks.some(t => t.title === 'Tarefa de TESTE'), 'mexer no teste não altera os dados oficiais');
  await p.evaluate(() => location.hash = '#config'); await p.waitForTimeout(300);
  check((await p.textContent('#cfg-drive')).includes('site de teste') && await p.locator('[data-act=driveConnect]').count() === 0, 'Google Drive desligado no teste');
  check(await p.locator('#bottom-nav a').count() === 4, 'teste: barra de baixo sem o botão Menu');
  // 3) Volta ao oficial: dados intactos
  await p.goto('http://localhost:8765/dist/gestao-rotina.html'); await p.waitForTimeout(500);
  check(await p.evaluate(() => S.tasks.some(t => t.title === 'Tarefa REAL') && !S.tasks.some(t => t.title === 'Tarefa de TESTE')), 'oficial continua com os dados reais');
  check(!errs.length, 'sem erros de JavaScript ' + errs.join(' | '));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
