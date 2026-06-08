const { chromium } = require('playwright');
const { spawn } = require('child_process');

const PAGES = [
  { name: 'index', path: '/' },
  { name: 'hisn', path: '/pages/hisn.html' },
  { name: 'azkar', path: '/pages/azkar.html' },
  { name: 'azkar2', path: '/pages/azkar2.html' },
  { name: 'sleeping', path: '/pages/sleeping.html' },
  { name: 'salah', path: '/pages/salah.html' },
  { name: 'duaa', path: '/pages/duaa.html' },
  { name: 'audio', path: '/pages/audio.html' },
  { name: 'radio', path: '/pages/radio.html' },
  { name: 'hadith', path: '/pages/hadith.html' },
  { name: 'hadith-viewer', path: '/pages/hadith-viewer.html' },
  { name: 'quran', path: '/pages/quran.html' },
  { name: 'quran-text', path: '/pages/quran-text.html' },
  { name: 'quran2', path: '/pages/quran2.html' },
  { name: 'takrar', path: '/pages/takrar.html' },
  { name: 'masbaha', path: '/pages/masbaha.html' },
  { name: 'qibla', path: '/pages/qibla.html' },
  { name: 'notifications', path: '/pages/notifications.html' },
  { name: 'howto', path: '/pages/howto.html' },
  { name: 'about', path: '/pages/about.html' },
];

async function waitForVite(port, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function testPage(page, url, pageConfig) {
  const result = {
    name: pageConfig.name,
    url: pageConfig.path,
    loaded: false,
    hasTitle: false,
    hasContent: false,
    consoleErrors: [],
    networkErrors: [],
    jsErrors: [],
    status: 'FAIL'
  };

  const consoleHandler = msg => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text());
  };
  const errorHandler = error => {
    result.jsErrors.push(error.message);
  };
  const requestFailHandler = req => {
    const failure = req.failure();
    if (failure && failure.errorText !== 'net::ERR_ABORTED') {
      result.networkErrors.push(`${req.url()} - ${failure.errorText}`);
    }
  };

  page.on('console', consoleHandler);
  page.on('pageerror', errorHandler);
  page.on('requestfailed', requestFailHandler);

  try {
    const waitUntil = pageConfig.name === 'radio' ? 'load' : 'networkidle';
    const response = await page.goto(`${url}${pageConfig.path}`, {
      waitUntil,
      timeout: 20000
    });
    
    result.loaded = response?.ok() || false;
    result.httpStatus = response?.status();
    
    await page.waitForTimeout(2000);

    const title = await page.title();
    result.hasTitle = title && title.length > 0;
    result.title = title;

    const bodyText = await page.evaluate(() => document.body?.innerText?.length || 0);
    result.hasContent = bodyText > 10;

    if (result.loaded && result.hasTitle && result.hasContent && result.jsErrors.length === 0) {
      result.status = 'PASS';
    } else if (result.loaded && result.hasContent) {
      result.status = 'WARN';
    }
  } catch (error) {
    result.jsErrors.push(error.message);
  }

  page.removeListener('console', consoleHandler);
  page.removeListener('pageerror', errorHandler);
  page.removeListener('requestfailed', requestFailHandler);

  return result;
}

async function testAllPages() {
  const PORT = 3854;
  
  console.log('Starting Vite dev server...');
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    stdio: 'pipe',
    shell: true,
    cwd: __dirname
  });
  
  let viteReady = false;
  vite.stdout.on('data', data => {
    const str = data.toString();
    if (str.includes('Local:') || str.includes('ready')) viteReady = true;
    process.stdout.write(`[vite] ${str}`);
  });
  vite.stderr.on('data', data => {
    process.stderr.write(`[vite err] ${data}`);
  });

  const ready = await waitForVite(PORT, 20000);
  if (!ready) {
    console.error('Vite failed to start');
    vite.kill();
    process.exit(1);
  }
  console.log('Vite ready!\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const results = [];

  for (const pageConfig of PAGES) {
    const page = await context.newPage();
    process.stdout.write(`Testing ${pageConfig.name}...`);
    const result = await testPage(page, `http://localhost:${PORT}`, pageConfig);
    results.push(result);
    console.log(` ${result.status}`);
    await page.close();
  }

  await browser.close();
  vite.kill();

  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS');
  const warned = results.filter(r => r.status === 'WARN');
  const failed = results.filter(r => r.status === 'FAIL');

  console.log(`\nTotal: ${results.length} | PASS: ${passed.length} | WARN: ${warned.length} | FAIL: ${failed.length}`);

  if (warned.length > 0) {
    console.log('\n--- WARNINGS ---');
    warned.forEach(r => {
      console.log(`\n  ${r.name} (${r.url})`);
      if (r.consoleErrors.length) console.log(`    Console errors: ${r.consoleErrors.join(', ')}`);
      if (r.jsErrors.length) console.log(`    JS errors: ${r.jsErrors.join(', ')}`);
      if (r.networkErrors.length) console.log(`    Network errors: ${r.networkErrors.join(', ')}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n--- FAILURES ---');
    failed.forEach(r => {
      console.log(`\n  ${r.name} (${r.url}) - HTTP ${r.httpStatus || 'N/A'}`);
      if (r.jsErrors.length) console.log(`    JS errors: ${r.jsErrors.join('\n      ')}`);
      if (r.networkErrors.length) console.log(`    Network errors: ${r.networkErrors.join('\n      ')}`);
    });
  }

  require('fs').writeFileSync('./test-results.json', JSON.stringify(results, null, 2));
  console.log('\nDetailed results saved to test-results.json');
}

testAllPages().catch(console.error);
