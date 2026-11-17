// Segurança: avisos sempre em texto puro, backup sem a chave da IA, dados de fora sem HTML escondido
const { chromium } = require('playwright');
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 873 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
  // Aviso (toast) nunca vira HTML
  await p.evaluate(() => { window.__x = 0; UI.toast('Não deu para ler: <img src=x onerror="window.__x=1">.mp3', 'warn', { label: '<b>ok</b>', onClick() {} }); });
  await p.waitForTimeout(300);
  check(await p.locator('.toast img').count() === 0 && await p.locator('.toast b').count() === 0 && await p.evaluate(() => window.__x) === 0, 'nome de arquivo com HTML aparece como texto no aviso (não roda nada)');
  check((await p.textContent('.toast')).includes('<img'), 'o texto aparece inteiro');
  await p.evaluate(() => UI.toast('Erro: ' + U.esc('a < b & "c"')));
  await p.waitForTimeout(200);
  check((await p.locator('.toast').last().textContent()).includes('a < b & "c"'), 'mensagens já escapadas continuam legíveis');
  // Backup e código de transferência sem a chave
  await p.evaluate(() => { S.settings.ia.key = 'CHAVE-SECRETA-123'; S.settings.ia.agente = 'meu agente'; commit(); });
  const code = await p.evaluate(() => Transfer.encode(S));
  const back = await p.evaluate(c => Transfer.decode(c), code);
  check(back.settings.ia.key === '' && back.settings.ia.agente === 'meu agente', 'código de transferência sai sem a chave da IA (o resto vai)');
  check(!(await p.evaluate(() => JSON.stringify(Transfer.semChave(S)))).includes('CHAVE-SECRETA') && await p.evaluate(() => S.settings.ia.key) === 'CHAVE-SECRETA-123', 'arquivo de backup sem a chave; a chave do aparelho continua');
  await p.evaluate(d => Transfer.confirmImport(d), back); await p.waitForTimeout(300);
  await p.click('.modal-wrap.open [data-yes]'); await p.waitForTimeout(400);
  check(await p.evaluate(() => S.settings.ia.key) === 'CHAVE-SECRETA-123', 'importar um backup mantém a chave que já estava neste aparelho');
  // Dados de fora com HTML escondido em campos de máquina
  const s = await p.evaluate(() => {
    const d = Store.defaults();
    d.tasks.push({ id: 'x"><img src=x onerror=window.__x=2>', title: '<b>título</b>', status: 'pendente"onclick="x', priority: 'media', category: 'administrativo', dueDate: U.today(), dueTime: '09:00', createdAt: new Date().toISOString() });
    d.settings.categories[0].color = 'red;"><script>window.__x=3</script>';
    Store.replace(d); Actions.goTasks({ status: 'todas' });
    return { id: S.tasks[0].id, st: S.tasks[0].status, cor: S.settings.categories[0].color, title: S.tasks[0].title, hora: S.tasks[0].dueTime };
  });
  await p.waitForTimeout(400);
  check(!/[<>"]/.test(s.id + s.st + s.cor) && s.title === '<b>título</b>' && s.hora === '09:00', 'ids, status e cores de fora são limpos; texto livre e horário não mudam');
  check(await p.evaluate(() => window.__x) === 0 && await p.locator('.task b').count() === 0 && (await p.textContent('.task')).includes('<b>título</b>'), 'nada roda e o título aparece como texto');
  check(!errs.length, 'sem erros' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
