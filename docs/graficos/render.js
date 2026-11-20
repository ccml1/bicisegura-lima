const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [html, png] of process.argv.slice(2).map((a) => a.split(':'))) {
    const p = await b.newPage({ deviceScaleFactor: 2 });
    await p.goto('file://' + require('path').resolve(html));
    const el = await p.$('svg'); await el.screenshot({ path: png });
    await p.close();
  }
  await b.close();
})();
