import {existsSync} from 'node:fs';
import {mkdir, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'clips');

const appUrl = process.env.STORYFORGE_DEMO_APP_URL || 'http://localhost:5173';
const apiUrl = process.env.STORYFORGE_DEMO_API_URL || new URL('/api', appUrl).toString().replace(/\/$/, '');
const projectId = process.env.STORYFORGE_DEMO_PROJECT_ID || '8';
const browserChannel = process.env.STORYFORGE_DEMO_BROWSER_CHANNEL || 'msedge';
const videoSize = {width: 1920, height: 1080};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requireVisible = async (locator, label) => {
  await locator.first().waitFor({state: 'visible', timeout: 15000}).catch((error) => {
    throw new Error(`Timed out waiting for ${label}: ${error.message}`);
  });
};

const getToken = async () => {
  const explicitToken = process.env.STORYFORGE_DEMO_TOKEN?.trim();
  if (explicitToken) return explicitToken;

  const username = process.env.STORYFORGE_DEMO_USERNAME;
  const password = process.env.STORYFORGE_DEMO_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Set STORYFORGE_DEMO_TOKEN, or STORYFORGE_DEMO_USERNAME and STORYFORGE_DEMO_PASSWORD before capturing UI clips.'
    );
  }

  const response = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({username, password}),
  });
  if (!response.ok) {
    throw new Error(`Login failed with HTTP ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  return payload.access_token;
};

const createContext = async (browser, token, clipName) => {
  const context = await browser.newContext({
    viewport: videoSize,
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outputDir,
      size: videoSize,
    },
  });

  await context.addInitScript(
    ({accessToken}) => {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('storyforge-theme-storage', JSON.stringify({state: {theme: 'parchment'}, version: 0}));
      localStorage.setItem(
        'storyforge-layout-storage',
        JSON.stringify({
          state: {
            navCollapsed: false,
            rightPanelOpen: false,
            rightPanelWidth: 320,
            focusMode: false,
            headerCollapsed: true,
            autoExpandHeaderInProject: true,
            defaultNavCollapsed: false,
            defaultAIPanelOpen: false,
          },
          version: 0,
        })
      );
      localStorage.setItem(
        'reader-settings',
        JSON.stringify({
          state: {
            settings: {
              theme: 'parchment',
              font: 'system',
              fontSize: 3,
              lineHeight: 2,
              margin: 2,
              displayMode: 'scroll',
            },
            bookmarks: {},
          },
          version: 0,
        })
      );
    },
    {accessToken: token}
  );

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);

  return {context, page, clipName};
};

const goto = async (page, route) => {
  await page.goto(new URL(route, appUrl).toString(), {waitUntil: 'domcontentloaded'});
  await page.waitForLoadState('networkidle', {timeout: 5000}).catch(() => undefined);
  await sleep(500);
};

const clickNext = async (page) => {
  await page.getByRole('button', {name: '下一步'}).click();
  await sleep(500);
};

const fillByPlaceholder = async (page, placeholder, value) => {
  const input = page.getByPlaceholder(placeholder).first();
  await requireVisible(input, `field "${placeholder}"`);
  await input.fill(value);
  await sleep(250);
};

const recordClip = async (browser, token, name, action) => {
  const targetPath = path.join(outputDir, `${name}.webm`);
  const {context, page} = await createContext(browser, token, name);
  console.log(`capturing ${name}.webm`);

  let video;
  try {
    await action(page);
    video = page.video();
  } finally {
    await context.close();
  }

  if (!video) {
    throw new Error(`No video object was created for ${name}`);
  }
  await video.saveAs(targetPath);
  await video.delete();

  if (!existsSync(targetPath)) {
    throw new Error(`Clip was not written: ${targetPath}`);
  }
};

const captureDashboard = async (page) => {
  await goto(page, '/dashboard');
  await requireVisible(page.getByRole('heading', {name: '我的书架'}), 'dashboard');
  await sleep(650);
  await page.getByText('测试1').first().hover().catch(() => undefined);
  await sleep(750);
  await page.getByText('测试2').first().hover().catch(() => undefined);
  await sleep(550);
  await page.getByRole('button', {name: '新建项目'}).click();
  await requireVisible(page.getByRole('heading', {name: '新建创作项目'}), 'create project page');
  await sleep(850);
};

const captureCreate = async (page) => {
  await goto(page, '/projects/new');
  await requireVisible(page.getByRole('heading', {name: '作品定位'}), 'create step 1');
  await fillByPlaceholder(page, '给作品起一个正式标题', '时间余额不足');
  await fillByPlaceholder(page, '介绍故事背景、主要人物关系', '一个只能用剩余寿命兑换线索的重生者，试图改写十年前的失败。');
  await clickNext(page);

  await fillByPlaceholder(page, '都市重生 / 玄幻穿越...', '都市科幻');
  await fillByPlaceholder(page, '一句话说清它为什么抓人', '每一次改命都会减少自己的时间余额。');
  await fillByPlaceholder(page, '详细描述你想要的故事', '故事要有强烈悬念、明确章节推进，并保持逐章共创时可确认、可修改。');
  await clickNext(page);

  await fillByPlaceholder(page, '搜索作家风格...', '刘慈欣');
  await sleep(500);
  await page.getByLabel(/启用 刘慈欣 风格/).click();
  await sleep(700);
  await clickNext(page);

  await fillByPlaceholder(page, '网络小说 / 出版...', '网络小说');
  await page.locator('input[placeholder="2000"]').fill('2200');
  await sleep(250);
  await page.locator('input[placeholder="10"]').fill('4');
  await sleep(800);
};

const captureWorkflow = async (page) => {
  await goto(page, `/projects/${projectId}/overview`);
  await requireVisible(page.getByText('质量闭环').or(page.getByText('章节')).first(), 'project overview');
  await sleep(800);
  await page.getByLabel('大纲').click();
  await sleep(900);
  await page.getByLabel('章节').click();
  await requireVisible(page.getByText('第1章').first(), 'chapter list');
  await page.mouse.wheel(0, 420);
  await sleep(900);
  await page.mouse.wheel(0, -260);
  await sleep(650);
};

const captureReaderEditor = async (page) => {
  await goto(page, `/projects/${projectId}/read/1`);
  await requireVisible(page.getByText('第1章').first(), 'reader chapter');
  await sleep(900);
  await page.mouse.wheel(0, 520);
  await sleep(700);
  await page.getByRole('button', {name: /^编辑$/}).click();
  await requireVisible(page.getByText('查看过程').or(page.getByText('上一章')).first(), 'editor');
  await sleep(900);
  await page.mouse.wheel(0, 420);
  await sleep(700);
};

const captureQualityExport = async (page) => {
  await goto(page, `/projects/${projectId}/analytics`);
  await requireVisible(page.getByText('质量').first(), 'quality dashboard');
  await sleep(850);
  await page.mouse.wheel(0, 360);
  await sleep(650);
  await page.getByLabel('导出分享').click();
  await requireVisible(page.getByText('导出').first(), 'export page');
  await sleep(1000);
};

const main = async () => {
  await mkdir(outputDir, {recursive: true});
  for (const file of await readdir(outputDir)) {
    if (file.endsWith('.webm')) {
      await rm(path.join(outputDir, file), {force: true});
    }
  }

  const token = await getToken();
  const browser = await chromium.launch({
    channel: browserChannel,
    headless: true,
  });

  try {
    await recordClip(browser, token, 'dashboard', captureDashboard);
    await recordClip(browser, token, 'create', captureCreate);
    await recordClip(browser, token, 'workflow', captureWorkflow);
    await recordClip(browser, token, 'reader-editor', captureReaderEditor);
    await recordClip(browser, token, 'quality-export', captureQualityExport);
  } finally {
    await browser.close().catch(() => undefined);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
