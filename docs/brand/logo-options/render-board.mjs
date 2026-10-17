import { chromium } from '../../../node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Run from any working directory: node docs/brand/logo-options/render-board.mjs
// All vector rasterisation and nearest-neighbour enlargement happen in Chromium.
const root = path.dirname(fileURLToPath(import.meta.url));
const dataUrl = async file => 'data:image/svg+xml;base64,' + Buffer.from(await readFile(path.join(root, file))).toString('base64');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 }, deviceScaleFactor: 1 });
  for (const id of ['a','b','c']) {
    const url = await dataUrl(`option-${id}/mark.svg`);
    await page.setContent(`<html style="background:transparent"><body style="margin:0;background:transparent"><img src="${url}" width="512" height="512"></body></html>`);
    await page.locator('img').evaluate(img => img.decode());
    await page.locator('img').screenshot({ path:path.join(root,`option-${id}/mark-512.png`), omitBackground:true });
  }

  const palettes = [
    ['a','#102B50','#1764E8','#34C9E8','#A8ECF8'],
    ['b','#103E40','#0F766E','#23B99D','#A1EDDA'],
    ['c','#272C59','#5555CE','#9A7CEF','#DDD3FF'],
  ];
  const columns = [];
  for (const [id,...colors] of palettes) {
    const normal = await dataUrl(`option-${id}/mark.svg`);
    const small = await dataUrl(`option-${id}/mark-small.svg`);
    const mono = await dataUrl(`option-${id}/mark-mono.svg`);
    const horizontal = await dataUrl(`option-${id}/lockup-horizontal.svg`);
    const dark = await dataUrl(`option-${id}/lockup-on-dark.svg`);
    // Recover the same vector colours as the supplied dark lockup for app use.
    const darkSource = await readFile(path.join(root,`option-${id}/lockup-on-dark.svg`),'utf8');
    const appMark = darkSource.slice(darkSource.indexOf('<g transform="translate(12 8) scale(.72)">'),darkSource.indexOf('<g fill="#F6FAFF"'))
      .replace('transform="translate(12 8) scale(.72)"','');
    const appUrl = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${appMark}</svg>`).toString('base64');
    columns.push(`<section>
      <header><span>Option ${id.toUpperCase()}</span><div class="swatches">${colors.map(c=>`<i style="background:${c}"></i>`).join('')}</div></header>
      <div class="hero"><img src="${normal}" width="330" height="330"></div>
      <div class="horizontal"><img src="${horizontal}"></div>
      <div class="dark"><img src="${dark}"></div>
      <div class="small-grid">${[16,24,32,64].map(n=>`<div class="size"><span>${n} px</span><div class="native"><img src="${small}" width="${n}" height="${n}"></div><canvas data-url="${small}" data-size="${n}" width="128" height="128"></canvas></div>`).join('')}</div>
      <div class="bottom"><div class="app"><img src="${appUrl}"></div><img class="mono" src="${mono}"><div class="mini-dark"><div class="dark-native">${[16,24,32].map(n=>`<img src="${small}" width="${n}" height="${n}">`).join('')}</div><canvas data-url="${small}" data-size="16" width="64" height="64"></canvas></div></div>
    </section>`);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scam Shield</title><style>
    *{box-sizing:border-box}body{margin:0;width:2400px;height:1600px;background:#EFF2F6;color:#102B50;font-family:Arial,sans-serif}
    main{padding:58px 64px 50px;display:grid;grid-template-columns:repeat(3,1fr);gap:30px;height:100%}
    section{background:white;border:1px solid #DCE2E9;border-radius:28px;overflow:hidden;padding:35px 32px}
    header{display:flex;align-items:center;justify-content:space-between;font-size:26px;font-weight:600;letter-spacing:.2px}
    .swatches{display:flex;gap:10px}.swatches i{display:block;width:23px;height:23px;border-radius:50%}
    .hero{height:445px;display:flex;align-items:center;justify-content:center}
    .horizontal{height:188px;display:flex;align-items:center;justify-content:center;border-top:1px solid #E6EBF0}
    .horizontal img,.dark img{width:100%;height:auto;display:block}
    .dark{margin-top:8px;height:202px;display:flex;align-items:center;background:#081B32;border-radius:24px;padding:0 8px}
    .small-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:47px}
    .size{text-align:center;font-size:17px;color:#607080}.native{height:90px;display:flex;align-items:center;justify-content:center}
    canvas{display:block;margin:auto;background:#F5F7FA;image-rendering:pixelated;border-radius:0}
    .bottom{margin-top:46px;padding-top:35px;border-top:1px solid #E6EBF0;display:flex;align-items:center;justify-content:space-between;gap:18px}
    .app{width:148px;height:148px;background:#081B32;border-radius:34px;display:flex;align-items:center;justify-content:center}
    .app img{width:126px;height:126px}.mono{width:130px;height:130px}.mini-dark{width:205px;height:148px;background:#081B32;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}.dark-native{display:flex;gap:18px;align-items:center}.mini-dark canvas{background:transparent;margin:0}
  </style></head><body><main>${columns.join('')}</main><script>
  window.boardReady = (async () => {
    await Promise.all([...document.images].map(img=>img.decode()));
    for (const canvas of document.querySelectorAll('canvas')) {
      const n = Number(canvas.dataset.size), img = new Image(); img.src=canvas.dataset.url; await img.decode();
      const source = document.createElement('canvas'); source.width=n; source.height=n;
      source.getContext('2d').drawImage(img,0,0,n,n);
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled=false;
      // Integer scale: no interpolated pixels in the enlarged crop.
      const scale=Math.floor(canvas.width/n), out=n*scale, inset=(canvas.width-out)/2;
      ctx.drawImage(source,inset,inset,out,out);
    }
  })();
  </script></body></html>`;
  await writeFile(path.join(root,'board.html'),html);
  await page.setContent(html);
  await page.evaluate(() => window.boardReady);
  await page.screenshot({ path:path.join(root,'board.png'), fullPage:true });
  console.log('Rendered board.png (2400 × 1600), board.html, and three transparent 512 × 512 marks.');
} finally { await browser.close(); }
