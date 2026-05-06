import {existsSync} from 'node:fs';
import {mkdir, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'stills');

const appUrl = process.env.STORYFORGE_DEMO_APP_URL || 'http://localhost:5173';
const apiUrl = process.env.STORYFORGE_DEMO_API_URL || new URL('/api', appUrl).toString().replace(/\/$/, '');
const projectId = process.env.STORYFORGE_DEMO_PROJECT_ID || '8';
const browserChannel = process.env.STORYFORGE_DEMO_BROWSER_CHANNEL || 'msedge';
const viewport = {width: 1920, height: 1080};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getToken = async () => {
  const explicitToken = process.env.STORYFORGE_DEMO_TOKEN?.trim();
  if (explicitToken) return explicitToken;

  const username = process.env.STORYFORGE_DEMO_USERNAME;
  const password = process.env.STORYFORGE_DEMO_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Set STORYFORGE_DEMO_TOKEN, or STORYFORGE_DEMO_USERNAME and STORYFORGE_DEMO_PASSWORD before capturing UI stills.'
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

const seedLocalStorage = async (context, token) => {
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
            rightPanelWidth: 340,
            rightPanelTab: 'chat',
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
};

const createPage = async (browser, token) => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });
  await seedLocalStorage(context, token);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);
  return {context, page};
};

const goto = async (page, route) => {
  await page.goto(new URL(route, appUrl).toString(), {waitUntil: 'domcontentloaded'});
  await page.waitForLoadState('networkidle', {timeout: 5000}).catch(() => undefined);
  await sleep(700);
};

const waitForAny = async (page, labels, name) => {
  const errors = [];
  for (const label of labels) {
    try {
      await page.getByText(label, {exact: false}).first().waitFor({state: 'visible', timeout: 3500});
      return;
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(`Could not verify ${name}. Tried: ${labels.join(', ')}. ${errors[0] || ''}`);
};

const screenshot = async (page, name) => {
  const filePath = path.join(outputDir, `${name}.png`);
  await page.screenshot({path: filePath, fullPage: false});
  if (!existsSync(filePath)) {
    throw new Error(`Still was not written: ${filePath}`);
  }
  console.log(`captured ${name}.png`);
};

const captureDashboard = async (page) => {
  await goto(page, '/dashboard');
  await waitForAny(page, ['我的书架', '新建项目'], 'dashboard');
  await screenshot(page, 'dashboard');
};

const captureCreate = async (page) => {
  await goto(page, '/projects/new');
  await waitForAny(page, ['新建创作项目', '作品定位'], 'create page');
  await screenshot(page, 'create-brief');
};

const captureOverview = async (page) => {
  await goto(page, `/projects/${projectId}/overview`);
  await waitForAny(page, ['质量闭环', '章节', '项目概览'], 'overview');
  await screenshot(page, 'overview');
};

const captureReader = async (page) => {
  await goto(page, `/projects/${projectId}/read/1`);
  await waitForAny(page, ['第1章', '上一页', '编辑'], 'reader');
  await screenshot(page, 'reader');
};

const captureEditor = async (page) => {
  await goto(page, `/projects/${projectId}/editor/1`);
  await waitForAny(page, ['查看过程', '上一章', '阅读'], 'editor');
  await page.mouse.wheel(0, 280);
  await sleep(300);
  await screenshot(page, 'editor');
};

const captureQuality = async (page) => {
  await goto(page, `/projects/${projectId}/analytics`);
  await waitForAny(page, ['总体质量', '质量分析', '质量'], 'quality');
  await screenshot(page, 'quality');
};

const captureExport = async (page) => {
  await goto(page, `/projects/${projectId}/export`);
  await waitForAny(page, ['导出', '分享', 'DOCX'], 'export');
  await screenshot(page, 'export');
};

const captureVersions = async (page) => {
  await goto(page, `/projects/${projectId}/versions`);
  await waitForAny(page, ['历史版本', '选择章节', '暂无历史版本'], 'versions');
  await screenshot(page, 'versions');
};

const main = async () => {
  await mkdir(outputDir, {recursive: true});
  for (const file of await readdir(outputDir).catch(() => [])) {
    if (file.endsWith('.png')) {
      await rm(path.join(outputDir, file), {force: true});
    }
  }

  const token = await getToken();
  const browser = await chromium.launch({
    channel: browserChannel,
    headless: true,
  });

  try {
    const {context, page} = await createPage(browser, token);
    try {
      await captureDashboard(page);
      await captureCreate(page);
      await captureOverview(page);
      await captureReader(page);
      await captureEditor(page);
      await captureQuality(page);
      await captureExport(page);
      await captureVersions(page);
    } finally {
      await context.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
