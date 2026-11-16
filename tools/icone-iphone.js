// Gera os ícones PNG do iPhone (Adicionar à Tela de Início) a partir do icon.svg.
// O iPhone não usa SVG e arredonda os cantos sozinho: fundo quadrado, sem transparência.
// Uso: node tools/icone-iphone.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const root = path.join(__dirname, '..');
  const svg = fs.readFileSync(path.join(root, 'icon.svg'), 'utf8').replace(/ rx="\d+"/, '');
  const b = await chromium.launch();
  for (const [file, size] of [['icon-180.png', 180], ['icon-512.png', 512]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(root, file), omitBackground: false });
    await p.close();
    console.log(file, size + 'px');
  }
  await b.close();
})();
