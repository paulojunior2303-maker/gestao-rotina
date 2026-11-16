// iPhone: app na Tela de Início (ícone, tela cheia, barra de status), aviso de como instalar, áudio do Safari e cache offline
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..');
const check = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('ok -', m); };
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
(async () => {
  // ---- Arquivos
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  check(/viewport-fit=cover/.test(html), 'viewport ocupa a tela toda (notch e barra de gestos)');
  check(/apple-mobile-web-app-capable/.test(html) && /apple-mobile-web-app-title" content="FlowFire"/.test(html) && /apple-mobile-web-app-status-bar-style/.test(html), 'metas do iPhone: tela cheia, nome e barra de status');
  check(/<link rel="apple-touch-icon" href="icon-180.png">/.test(html), 'ícone do iPhone no index.html');
  const png = fs.readFileSync(path.join(root, 'icon-180.png'));
  check(png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 180 && png.readUInt32BE(20) === 180, 'icon-180.png é PNG de 180×180');
  const unico = fs.readFileSync(path.join(root, 'dist/gestao-rotina.html'), 'utf8');
  check(unico.includes('rel="apple-touch-icon" href="https://paulojunior2303-maker.github.io/gestao-rotina/icon-180.png"'), 'arquivo único (APK/link) aponta para o ícone com endereço completo');
  const teste = fs.readFileSync(path.join(root, 'dist/gestao-rotina-teste.html'), 'utf8');
  check(teste.includes('rel="apple-touch-icon" href="icon-180.png"') && fs.readFileSync(path.join(root, 'tools/publicar-teste.sh'), 'utf8').includes('teste/icon-180.png'), 'site de teste usa a cópia do ícone na pasta teste/');
  const pages = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  check(pages.includes('icon-180.png') && pages.includes('icon-512.png'), 'site publica os ícones PNG');
  // Service worker: a lista de arquivos precisa bater com os scripts (senão o app não funciona sem internet)
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const files = [...sw.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  const missing = files.filter(f => !fs.existsSync(path.join(root, f)));
  check(!missing.length, 'sw.js só lista arquivos que existem' + (missing.length ? ': ' + missing.join(', ') : ''));
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  const fora = scripts.filter(s => !files.includes(s));
  check(!fora.length, 'sw.js guarda todos os scripts do app' + (fora.length ? ' (faltam: ' + fora.join(', ') + ')' : ''));

  // ---- No "iPhone" (Safari)
  const b = await chromium.launch();
  const mk = async (standalone) => {
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
    if (standalone) await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
    return { p, errs };
  };
  const { p, errs } = await mk(false);
  check(await p.locator('.ios-card').count() === 1 && (await p.textContent('.ios-card')).includes('Adicionar à Tela de Início'), 'Safari do iPhone: aviso ensina a pôr na Tela de Início');
  await p.tap('.ios-card [data-act=iosOk]'); await p.waitForTimeout(300);
  check(await p.locator('.ios-card').count() === 0, '"Entendi" esconde o aviso');
  await p.reload(); await p.waitForTimeout(600);
  check(await p.locator('.ios-card').count() === 0, 'o aviso não volta depois');
  const meta = () => p.getAttribute('meta[name="apple-mobile-web-app-status-bar-style"]', 'content');
  check(await meta() === 'black-translucent', 'tema escuro: letras brancas na barra de status');
  await p.evaluate(() => { S.settings.theme = 'claro'; commit(); Theme.apply(); });
  check(await meta() === 'default', 'tema claro: letras escuras na barra de status');
  await p.evaluate(() => { S.settings.theme = 'escuro'; commit(); Theme.apply(); });
  const mi = await p.evaluate(() => [IA.mimeIA('audio/mp4;codecs=mp4a.40.2'), IA.mimeIA('audio/mp4'), IA.mimeIA('audio/webm;codecs=opus'), IA.mimeIA('audio/ogg')]);
  check(mi[0] === 'audio/mp4' && mi[1] === 'audio/mp4' && mi[2] === 'audio/webm;codecs=opus' && mi[3] === 'audio/ogg', 'áudio do iPhone (MP4) vai para a IA com o tipo certo; os outros não mudam');
  await p.evaluate(() => { location.hash = '#guia'; }); await p.waitForTimeout(300);
  check((await p.textContent('.view')).includes('No iPhone'), 'Guia de uso explica como usar no iPhone');
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check(w <= 393, `cabe na largura do iPhone (${w}px)`);
  check(!errs.length, 'sem erros' + (errs.length ? ': ' + errs.join(' | ') : ''));
  // Já instalado na Tela de Início: sem aviso
  const s2 = await mk(true);
  check(await s2.p.locator('.ios-card').count() === 0, 'aberto pela Tela de Início: sem o aviso');
  // Android/computador: sem aviso
  const ctx3 = await b.newContext({ viewport: { width: 393, height: 852 } }); const p3 = await ctx3.newPage();
  await p3.goto('http://localhost:8765/'); await p3.waitForTimeout(600);
  check(await p3.locator('.ios-card').count() === 0, 'fora do iPhone: sem o aviso');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
