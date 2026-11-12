// Google Drive: conectar no app Android e no site, sincronizar nos dois sentidos, conflito na 1ª conexão, reconectar e desconectar.
// O Google é simulado: um "Drive falso" em memória atende às mesmas chamadas da API real.
const OUT = require('path').join(__dirname, 'output'); require('fs').mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
let pass = 0, fail = 0; const check = (c, m) => { if (c) { pass++; console.log('  ok -', m); } else { fail++; console.log('  XX -', m); } };

// ---------- Drive falso ----------
const drive = { files: {}, n: 0, calls: [], tokens: new Set(['tok-android', 'tok-web']) };
const parseMultipart = (body, ct) => {
  const b = ct.match(/boundary=([^;]+)/)[1];
  const parts = body.split('--' + b).filter(p => p.includes('\r\n\r\n'));
  return parts.map(p => p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, ''));
};
async function fakeGoogle(route) {
  const req = route.request(), url = new URL(req.url()), auth = req.headers()['authorization'] || '';
  drive.calls.push(req.method() + ' ' + url.pathname);
  if (url.hostname === 'oauth2.googleapis.com') return route.fulfill({ status: 200, body: '' });
  if (url.hostname === 'accounts.google.com') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
  if (!drive.tokens.has(auth.replace('Bearer ', ''))) return route.fulfill({ status: 401, json: { error: { message: 'Invalid Credentials' } } });
  const p = url.pathname;
  if (p === '/drive/v3/about') return route.fulfill({ json: { user: { emailAddress: 'lider@exemplo.com' } } });
  if (p === '/drive/v3/files' && req.method() === 'GET') {
    const q = url.searchParams.get('q');
    const name = q.match(/name='([^']+)'/)[1], parent = (q.match(/'([^']+)' in parents/) || [])[1];
    const files = Object.values(drive.files).filter(f => f.name === name && !f.trashed && (!parent || f.parents.includes(parent)));
    return route.fulfill({ json: { files: files.map(f => ({ id: f.id, appProperties: f.appProperties })) } });
  }
  if (p === '/drive/v3/files' && req.method() === 'POST') {
    const m = JSON.parse(req.postData()); const id = 'f' + (++drive.n);
    drive.files[id] = { id, name: m.name, mimeType: m.mimeType, parents: m.parents || [], appProperties: {} };
    return route.fulfill({ json: { id } });
  }
  const up = p.match(/^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/);
  if (up) {
    const [meta, content] = parseMultipart(req.postData(), req.headers()['content-type']);
    const m = JSON.parse(meta); let id = up[1];
    if (!id) { id = 'f' + (++drive.n); drive.files[id] = { id, parents: m.parents || [] }; }
    Object.assign(drive.files[id], { name: m.name, appProperties: m.appProperties || {}, content });
    return route.fulfill({ json: { id } });
  }
  const one = p.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (one) {
    const f = drive.files[one[1]]; if (!f) return route.fulfill({ status: 404, json: { error: { message: 'not found' } } });
    if (url.searchParams.get('alt') === 'media') return route.fulfill({ status: 200, contentType: 'application/json', body: f.content });
    return route.fulfill({ json: { id: f.id, trashed: !!f.trashed, appProperties: f.appProperties } });
  }
  return route.fulfill({ status: 400, json: { error: { message: 'rota não simulada ' + p } } });
}
const remoteState = () => { const f = Object.values(drive.files).find(x => x.name === 'gestao-rotina-dados.json'); return f && JSON.parse(f.content); };

(async () => {
  const b = await chromium.launch();
  const W = (p, ms = 300) => p.waitForTimeout(ms);
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('gestao-rotina-wibicam:v1')));
  const skipTour = async p => { await W(p, 600); if (await p.locator('[data-tour=skip]').count()) { await p.locator('[data-tour=skip]').click(); await W(p); } };
  const fill = (p, n, v) => p.fill(`.modal-wrap.open [name="${n}"]`, v);
  const addTask = async (p, title) => { await p.evaluate(() => location.hash = '#agenda'); await W(p); await p.locator('#fab').click(); await W(p); await p.locator('.sheet-item:has-text("Tarefa")').click(); await W(p); await fill(p, 'title', title); await p.locator('.modal-wrap.open [data-submit]').click(); await W(p); };

  // ---------- App Android (Capacitor simulado, com o plugin Google) ----------
  const actx = await b.newContext({ viewport: { width: 393, height: 873 }, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await actx.route(/googleapis\.com|accounts\.google\.com/, fakeGoogle);
  await actx.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
  await actx.addInitScript(() => {
    const listeners = {}; window.__fire = (ev, d) => (listeners[ev] || []).forEach(f => f(d || {}));
    window.__authorized = sessionStorage.getItem('__auth') === '1';
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      App: { addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); }, exitApp() {}, getInfo: async () => ({ version: '9.9.9' }) },
      Filesystem: { writeFile: async () => ({ uri: '' }), readFile: async () => { throw new Error('x'); } },
      Share: { share: async () => {} }, Printer: { print: async () => {} },
      LocalNotifications: { checkPermissions: async () => ({ display: 'denied' }), getPending: async () => ({ notifications: [] }), cancel: async () => {}, schedule: async () => {}, createChannel: async () => {}, registerActionTypes: async () => {}, addListener() {} },
      Sistema: { status: async () => ({ bateriaLiberada: true, fabricante: 'xiaomi' }), abrir: async () => {}, manterTela: async () => {} },
      Google: { autorizar: async (o) => {
        window.__authCalls = (window.__authCalls || 0) + 1;
        if (!window.__authorized && !o.interativo) { const e = new Error('É preciso autorizar'); e.code = 'PRECISA_AUTORIZAR'; throw e; }
        window.__authorized = true; sessionStorage.setItem('__auth', '1');
        return { accessToken: 'tok-android', escopos: o.escopos };
      } },
    } };
  });
  const a = await actx.newPage(); const errs = []; a.on('pageerror', e => errs.push('android: ' + e.message));
  await a.goto('http://localhost:8765/android-app/www/index.html'); await skipTour(a);
  console.log('\n[1] Conectar no app Android');
  await addTask(a, 'Tarefa criada no celular');
  await a.evaluate(() => location.hash = '#config'); await W(a);
  check(await a.locator('#cfg-drive [data-act=driveConnect]').count() === 1, 'Configurações → Google Drive: botão "Conectar com o Google"');
  await a.screenshot({ path: OUT + '/drive-1-desconectado.png' });
  await a.locator('#cfg-drive [data-act=driveConnect]').tap(); await W(a, 1200);
  check(await a.evaluate(() => window.__authCalls) >= 1 && (await a.textContent('#cfg-drive')).includes('lider@exemplo.com'), 'autoriza a conta e mostra o e-mail conectado');
  let r = remoteState();
  check(r && r.state.tasks.some(t => t.title === 'Tarefa criada no celular') && r.device === 'app Android', 'dados do celular enviados para a pasta do Drive');
  check(Object.values(drive.files).some(f => f.name === 'Gestão de Rotina' && f.mimeType === 'application/vnd.google-apps.folder'), 'cria a pasta "Gestão de Rotina" no Drive');
  check((await a.textContent('#storage-status')).includes('Google Drive'), 'menu lateral: "Sincronizado com o Google Drive"');
  await a.screenshot({ path: OUT + '/drive-2-conectado.png' });
  await addTask(a, 'Segunda tarefa do celular'); await W(a, 3200);
  check(remoteState().state.tasks.some(t => t.title === 'Segunda tarefa do celular'), 'alteração no celular sobe sozinha para o Drive (alguns segundos depois)');

  // ---------- Site (navegador, Google Identity Services simulado) ----------
  const wctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await wctx.route(/googleapis\.com|accounts\.google\.com/, fakeGoogle);
  await wctx.addInitScript(() => {
    window.google = { accounts: { oauth2: { initTokenClient: cfg => ({ requestAccessToken: o => { window.__gisCalls = (window.__gisCalls || []).concat([o]); setTimeout(() => cfg.callback({ access_token: 'tok-web', expires_in: 3599 }), 50); } }) } } };
  });
  const w = await wctx.newPage(); w.on('pageerror', e => errs.push('web: ' + e.message));
  await w.goto('http://localhost:8765/index.html'); await skipTour(w);
  console.log('\n[2] Site: já tem dados → escolher qual versão vale');
  await addTask(w, 'Tarefa antiga do navegador');
  await w.evaluate(() => location.hash = '#config'); await W(w);
  await w.locator('#cfg-drive [data-act=driveConnect]').click(); await W(w, 1200);
  check(await w.locator('.modal-wrap.open [data-remote]').count() === 1 && (await w.textContent('.modal-wrap.open')).includes('app Android'), 'os dois lados têm dados: pergunta qual versão usar (mostra que veio do app Android)');
  await w.screenshot({ path: OUT + '/drive-3-escolha.png' });
  await w.locator('.modal-wrap.open [data-remote]').click(); await W(w, 800);
  let ws = await st(w);
  check(ws.tasks.some(t => t.title === 'Segunda tarefa do celular') && !ws.tasks.some(t => t.title === 'Tarefa antiga do navegador'), '"Usar os do Drive": site fica igual ao celular');
  check((await w.evaluate(() => window.__gisCalls))[0].prompt === 'consent', 'site usa o login do Google (1ª vez com consentimento)');

  console.log('\n[3] Site → celular');
  await addTask(w, 'Tarefa feita no computador'); await W(w, 3200);
  check(remoteState().state.tasks.some(t => t.title === 'Tarefa feita no computador') && remoteState().device === 'navegador', 'alteração no site sobe para o Drive');
  await a.evaluate(() => { Drive.lastAuto = 0; __fire('resume'); }); await W(a, 1500);
  let as = await st(a);
  check(as.tasks.some(t => t.title === 'Tarefa feita no computador'), 'ao voltar para o app, o celular baixa a alteração do site');
  check(as.settings.ia !== undefined && as.meta.updatedAt === remoteState().updatedAt, 'celular fica com a mesma versão do Drive');

  console.log('\n[4] Celular → site, ao reabrir o site');
  await addTask(a, 'Tarefa nova no celular depois'); await W(a, 3200);
  await w.reload(); await W(w, 1500);
  ws = await st(w);
  check(ws.tasks.some(t => t.title === 'Tarefa nova no celular depois'), 'site reaberto na mesma sessão baixa sozinho a alteração do celular');

  console.log('\n[5] Site com a conexão do Google vencida');
  await w.evaluate(() => { sessionStorage.removeItem('gr-drive-token'); Drive.token = null; Drive.lastAuto = 0; });
  await w.reload(); await W(w, 1500);
  check(await w.locator('.drive-banner').count() === 1, 'conexão vencida: aviso "Reconecte o Google Drive" com botão Sincronizar');
  await w.screenshot({ path: OUT + '/drive-4-reconectar.png' });
  await w.locator('.drive-banner [data-act=driveSync]').click(); await W(w, 1200);
  check(await w.locator('.drive-banner').count() === 0 && (await w.evaluate(() => Drive.state)) === 'ok', 'tocar em Sincronizar reconecta e o aviso some');
  const last = (await w.evaluate(() => window.__gisCalls)).pop();
  check(last.prompt === '' && last.login_hint === 'lider@exemplo.com', 'reconexão não pede consentimento de novo (mesma conta)');

  console.log('\n[6] Arquivo apagado no Drive e token recusado');
  for (const f of Object.values(drive.files)) if (f.name === 'gestao-rotina-dados.json') f.trashed = true;
  await a.evaluate(() => { Drive.lastAuto = 0; __fire('resume'); }); await W(a, 1500);
  check(Object.values(drive.files).some(f => f.name === 'gestao-rotina-dados.json' && !f.trashed), 'arquivo apagado do Drive: o app cria de novo');
  drive.tokens.delete('tok-android'); await a.evaluate(() => { Drive.lastAuto = 0; __fire('resume'); }); await W(a, 1500);
  check((await a.evaluate(() => Drive.state)) === 'error', 'token recusado: mostra erro em vez de travar');
  drive.tokens.add('tok-android'); await a.evaluate(() => { Drive.lastAuto = 0; __fire('resume'); }); await W(a, 1500);
  check((await a.evaluate(() => Drive.state)) === 'ok', 'volta a sincronizar sozinho quando o Google aceita de novo');

  console.log('\n[7] Desconectar');
  await a.evaluate(() => location.hash = '#config'); await W(a);
  await a.locator('#cfg-drive [data-act=driveOff]').tap(); await W(a); await a.locator('.modal-wrap.open [data-yes]').tap(); await W(a, 500);
  check(await a.locator('#cfg-drive [data-act=driveConnect]').count() === 1 && (await st(a)).tasks.length >= 3, 'desconectar mantém os dados no celular e volta a oferecer "Conectar"');
  check(drive.calls.some(c => c.includes('/revoke')), 'desconectar revoga o acesso no Google');

  check(!errs.length, 'sem erros de JavaScript ' + errs.join(' | '));
  console.log(`\nRESULTADO: ${pass} ok, ${fail} falhas`);
  await b.close();
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
