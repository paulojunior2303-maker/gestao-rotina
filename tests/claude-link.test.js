const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
(async () => {
  const b = await chromium.launch();
  const store = {}; const saved = [];
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
    await ctx.exposeBinding('__dbGet', (_, col) => Object.entries(store).filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.slice(col.length + 1), data: v })));
    await ctx.exposeBinding('__dbSet', (_, path, data) => { store[path] = data; });
    await ctx.exposeBinding('__dbDel', (_, path) => { delete store[path]; });
    await ctx.exposeBinding('__dl', (_, name, size) => { saved.push([name, size]); });
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('SecurityError'); } });
      const db = { collection: (col) => ({
        get: async () => { const rows = await window.__dbGet(col); return { empty: !rows.length, docs: rows.map(r => ({ id: r.id, exists: true, data: () => r.data })) }; },
        doc: (id) => ({ set: (d) => window.__dbSet(col + '/' + id, JSON.parse(JSON.stringify(d))), delete: () => window.__dbDel(col + '/' + id) }),
      }) };
      const user = { id: async () => 'u123' };
      const downloads = { save: async ({ filename, data }) => { await window.__dl(filename, data.size || data.length); return { status: 'saved' }; } };
      window.claude = { use: (n) => new Promise(r => setTimeout(() => r({ db, user, downloads }[n] || null), 300)) };
      window.print = () => { throw new Error('print bloqueado'); };
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.errs = errs; return p;
  };
  const p = await mk();
  await p.goto('http://localhost:8765/dist/gestao-rotina.html'); await p.waitForTimeout(1200);
  assert(await p.locator('.tour-wrap').count() === 1, 'tutorial aparece no primeiro acesso'); await p.locator('[data-tour=skip]').click(); await p.waitForTimeout(1200);
  assert((await p.textContent('#storage-status')).includes('sua conta'), 'conectado: dados salvos na conta');
  assert(Object.keys(store).includes('data/users/u123/core'), 'primeiro acesso envia o estado inicial para a conta');
  assert(await p.locator('.alert.a-red').count() === 0 || !(await p.textContent('#view')).includes('Não há onde salvar'), 'sem aviso de armazenamento');
  await p.goto('http://localhost:8765/dist/gestao-rotina.html#tarefas'); await p.waitForTimeout(1200);
  await p.click('[data-act=tkNew]'); await p.fill('.modal-wrap.open [name=title]', 'Tarefa na nuvem'); await p.fill('.modal-wrap.open [name=dueDate]', '2026-11-12'); await p.click('.modal-wrap.open [data-submit]');
  await p.goto('http://localhost:8765/dist/gestao-rotina.html#agenda'); await p.waitForTimeout(1200);
  await p.locator('.blk').first().locator('[data-s=concluida]').click(); await p.waitForTimeout(1200);
  assert(store['data/users/u123/tasks'].items[0].title === 'Tarefa na nuvem', 'tarefa gravada no documento tasks');
  assert(Object.keys(store).some(k => k.includes('/days-2026-11')), 'agenda do dia gravada no documento do mês');
  // indicadores e exportações
  await p.goto('http://localhost:8765/dist/gestao-rotina.html#indicadores'); await p.waitForTimeout(1200);
  await p.click('[data-act=indNew]'); await p.fill('.modal-wrap.open [name=osConcluidas]', '6'); await p.click('.modal-wrap.open [data-submit]'); await p.waitForTimeout(1200);
  assert(Object.keys(store).some(k => k.includes('/ind-2026-11')), 'indicadores gravados por mês');
  await p.click('[data-act=indXlsx]'); await p.waitForTimeout(400);
  await p.click('[data-act=indPdf]'); await p.waitForTimeout(400);
  await p.goto('http://localhost:8765/dist/gestao-rotina.html#config'); await p.waitForTimeout(1200);
  await p.click('[data-act=dataExport]'); await p.waitForTimeout(400);
  assert(saved.some(s => s[0].endsWith('.xlsx')) && saved.some(s => s[0].endsWith('.html')) && saved.some(s => s[0].endsWith('.json')), 'Excel, relatório e backup entregues pela confirmação de download: ' + saved.map(s => s[0]).join(', '));
  // outro "aparelho": novo contexto, mesmos dados da conta
  const p2 = await mk();
  await p2.goto('http://localhost:8765/dist/gestao-rotina.html#tarefas'); await p2.waitForTimeout(1500);
  assert(await p2.locator('.tour-wrap').count() === 0, 'tutorial não reaparece em outro aparelho da mesma conta');
  assert(await p2.locator('.task', { hasText: 'Tarefa na nuvem' }).count() === 1, 'outro aparelho carrega a tarefa da conta');
  await p2.goto('http://localhost:8765/dist/gestao-rotina.html#agenda'); await p2.waitForTimeout(1500);
  assert(await p2.locator('.blk.st-concluida').count() === 1, 'outro aparelho vê a atividade concluída');
  assert(!p.errs.length && !p2.errs.length, 'sem erros de página ' + p.errs.concat(p2.errs).join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
