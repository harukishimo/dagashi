const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const workspace = '/Users/haruki.shimo/vitalize/dagashi';
const renderedDir = '/private/tmp/dagashi-demo-rendered';
const outputDir = path.join(workspace, 'outputs', 'demo-videos');
const browserExecutable = '/Users/haruki.shimo/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function moveAndClick(page, locator, pauseAfter = 900) {
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('クリック対象の位置を取得できませんでした');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 16 });
  await wait(280);
  await page.mouse.down();
  await wait(130);
  await page.mouse.up();
  await wait(pauseAfter);
}

async function typeInto(page, locator, value) {
  await moveAndClick(page, locator, 200);
  await page.keyboard.type(value, { delay: 115 });
  await wait(500);
}

async function record(name, htmlFile, scenario) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutable,
    args: ['--disable-dev-shm-usage']
  });
  const rawDir = path.join('/private/tmp', `dagashi-video-${name}`);
  await fs.mkdir(rawDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 720 },
    colorScheme: 'light',
    recordVideo: {
      dir: rawDir,
      size: { width: 1024, height: 720 }
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('ERR_FILE_NOT_FOUND')) {
      errors.push(message.text());
    }
  });
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
  const frame = page.frameLocator('iframe');
  await frame.locator('#dagashi-' + (name === 'child' ? 'child' : 'admin') + '-demo').waitFor({ state: 'visible' });
  await wait(1400);
  const video = page.video();
  await scenario(page, frame);
  await wait(1200);
  await context.close();
  const rawVideo = await video.path();
  const output = path.join(outputDir, name === 'child'
    ? 'child-shopping-experience-demo.webm'
    : 'admin-operation-demo.webm');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.copyFile(rawVideo, output);
  await browser.close();
  if (errors.length) {
    throw new Error(`${name} demo browser errors:\n${errors.join('\n')}`);
  }
  return output;
}

async function childScenario(page, frame) {
  const byTestId = id => frame.locator(`[data-testid="${id}"]`);
  await moveAndClick(page, byTestId('start-shopping'), 1500);
  await moveAndClick(page, byTestId('add-ramune'), 700);
  await moveAndClick(page, byTestId('add-ramune'), 700);
  await moveAndClick(page, byTestId('add-choco'), 700);
  await moveAndClick(page, byTestId('add-gummy'), 1200);
  await moveAndClick(page, byTestId('open-cart'), 2100);
  await moveAndClick(page, byTestId('go-payment'), 2300);
  await moveAndClick(page, byTestId('confirm-payment'), 2200);
  await moveAndClick(page, byTestId('challenge-start'), 3400);
  await moveAndClick(page, byTestId('challenge-stop'), 3000);
  await moveAndClick(page, byTestId('result-next'), 2200);
  await moveAndClick(page, byTestId('finish-shopping'), 1600);
}

async function adminScenario(page, frame) {
  const byTestId = id => frame.locator(`[data-testid="${id}"]`);
  for (const digit of ['2', '5', '8', '0']) {
    await moveAndClick(page, byTestId(`pin-${digit}`), 450);
  }
  await moveAndClick(page, byTestId('pin-login'), 2100);
  await moveAndClick(page, byTestId('nav-sales'), 2300);
  await moveAndClick(page, byTestId('sales-export'), 1900);
  await moveAndClick(page, byTestId('nav-products'), 1800);
  await moveAndClick(page, byTestId('add-product'), 1700);
  await typeInto(page, byTestId('product-name'), 'フルーツもち');
  await typeInto(page, byTestId('product-price'), '60');
  await moveAndClick(page, byTestId('save-product'), 2100);
  await moveAndClick(page, byTestId('image-mochi'), 1100);
  await moveAndClick(page, byTestId('save-product'), 2300);
  await moveAndClick(page, byTestId('nav-transactions'), 2100);
  await moveAndClick(page, byTestId('transaction-export'), 2200);
  await moveAndClick(page, byTestId('nav-dashboard'), 2600);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const target = process.argv[2] || 'all';
  const outputs = [];
  if (target === 'all' || target === 'child') {
    outputs.push(await record('child', path.join(renderedDir, 'child-shopping-demo.html'), childScenario));
  }
  if (target === 'all' || target === 'admin') {
    outputs.push(await record('admin', path.join(renderedDir, 'admin-dashboard-demo.html'), adminScenario));
  }
  process.stdout.write(`${outputs.join('\n')}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
