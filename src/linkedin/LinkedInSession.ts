import puppeteer, { Browser, Page } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs/promises';
import { setTimeout as sleep } from 'timers/promises';

const COOKIE_PATH = path.resolve(process.env.COOKIES_DIR || './cookies', 'linkedin_cookies.json');

export class LinkedInSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private loggedIn = false;

  async initialize(): Promise<Page> {
    const headless = process.env.PUPPETEER_HEADLESS === 'true';
    const slowMo = parseInt(process.env.PUPPETEER_SLOW_MO || '50', 10);
    const viewportWidth = parseInt(process.env.PUPPETEER_VIEWPORT_WIDTH || '1366', 10);
    const viewportHeight = parseInt(process.env.PUPPETEER_VIEWPORT_HEIGHT || '768', 10);

    const launchOptions = {
      headless,
      slowMo,
      protocolTimeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-size=1366,768',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (executablePath) {
      (launchOptions as any).executablePath = executablePath;
    } else {
      (launchOptions as any).executablePath = await chromium.executablePath();
      (launchOptions as any).args.push('--disable-gpu', '--disable-dev-shm-usage');
    }

    this.browser = await puppeteer.launch(launchOptions);

    this.page = await this.browser.newPage();
    await this.page.setDefaultNavigationTimeout(60000);
    await this.page.setDefaultTimeout(30000);
    await this.page.setViewport({ width: viewportWidth, height: viewportHeight });

    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] as unknown as PluginArray });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-ES', 'es', 'en'] });
    });

    await this._tryRestoreSession();

    if (!this.loggedIn) {
      await this._manualLogin();
    }

    // Stabilize session after login — navigate to feed and verify
    console.log('[LinkedInSession] Stabilizing session...');
    await this._navigateWithRetry('https://www.linkedin.com/feed/', 2);
    await sleep(5000);
    const stable = await this._checkLoggedIn();
    if (!stable) {
      console.log('[LinkedInSession] Session lost during stabilization. Re-login required.');
      this.loggedIn = false;
      await this._manualLogin();
      await this._navigateWithRetry('https://www.linkedin.com/feed/', 2);
      await sleep(3000);
    }
    console.log('[LinkedInSession] Session stable.\n');

    return this.page;
  }

  private async _tryRestoreSession(): Promise<void> {
    let cookiesJson: string | null = null;

    // 1. Intentar leer de env var LINKEDIN_COOKIES (para Render)
    const envCookies = process.env.LINKEDIN_COOKIES;
    if (envCookies) {
      try {
        cookiesJson = envCookies;
        console.log('[LinkedInSession] Cookies found in LINKEDIN_COOKIES env var.');
      } catch {
        console.log('[LinkedInSession] LINKEDIN_COOKIES env var found but invalid.');
      }
    }

    // 2. Si no hay env var, intentar leer del archivo (para local)
    if (!cookiesJson) {
      try {
        cookiesJson = await fs.readFile(COOKIE_PATH, 'utf-8');
        console.log('[LinkedInSession] Cookies found in file.');
      } catch {
        console.log('[LinkedInSession] No saved cookies found.');
        return;
      }
    }

    try {
      const cookies = JSON.parse(cookiesJson);
      if (cookies.length > 0) {
        await this.page!.setCookie(...cookies);
        console.log(`[LinkedInSession] ${cookies.length} cookies restored.`);
      } else {
        console.log('[LinkedInSession] Cookies data is empty.');
        return;
      }
    } catch {
      console.log('[LinkedInSession] Failed to parse cookies JSON.');
      return;
    }

    console.log('[LinkedInSession] Navigating to LinkedIn feed to verify session...');
    try {
      await this.page!.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });
    } catch (err) {
      console.log('[LinkedInSession] Failed to navigate to feed:', err instanceof Error ? err.message : err);
      return;
    }

    const currentUrl = this.page!.url();
    console.log(`[LinkedInSession] Current URL after navigation: ${currentUrl}`);

    await sleep(5000);

    const isLoggedIn = await this._checkLoggedIn();
    if (isLoggedIn) {
      this.loggedIn = true;
      console.log('[LinkedInSession] ✓ Session valid! Cookies accepted.');
    } else {
      console.log('[LinkedInSession] ✗ Session invalid. Cookies expired or rejected by LinkedIn.');
    }
  }

  private async _checkLoggedIn(): Promise<boolean> {
    try {
      const url = this.page!.url();
      console.log(`[LinkedInSession] Checking login - URL: ${url}`);
      if (url.includes('login') || url.includes('checkpoint')) return false;

      const checks = await this.page!.evaluate(() => {
        const bools: Record<string, boolean> = {};
        bools['feed-context'] = !!document.querySelector('div[data-feed-context]');
        bools['nav-photo'] = !!document.querySelector('.global-nav__me-photo');
        bools['nav-item'] = !!document.querySelector('.global-nav__me');
        bools['feed-layout'] = !!document.querySelector('.feed-identity-module');
        bools['scaffold'] = !!document.querySelector('.scaffold-layout');
        bools['authwall'] = !!document.querySelector('.authwall');
        bools['login-form'] = !!document.querySelector('#login-email');
        const bodyClass = document.body.className.substring(0, 200);
        const title = document.title;
        return { bools, bodyClass, title };
      });

      console.log('[LinkedInSession] Login checks:', JSON.stringify(checks.bools));
      console.log(`[LinkedInSession] Page title: ${checks.title}`);
      console.log(`[LinkedInSession] Body class: ${checks.bodyClass}`);

      if (checks.bools['authwall'] || checks.bools['login-form']) return false;
      if (checks.bools['feed-context'] || checks.bools['nav-photo'] || checks.bools['nav-item'] || checks.bools['feed-layout'] || checks.bools['scaffold']) return true;

      return false;
    } catch {
      return false;
    }
  }

  private async _manualLogin(): Promise<void> {
    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (!email || !password) {
      throw new Error(
        '[LinkedInSession] No credentials (LINKEDIN_EMAIL/LINKEDIN_PASSWORD) and no cookies available. ' +
        'Run the bot locally first, log in manually, then copy the cookies to LINKEDIN_COOKIES env var on Render.'
      );
    }

    console.log('[LinkedInSession] Attempting auto-login with credentials...');
    await this._navigateWithRetry('https://www.linkedin.com/login', 2);

    try {
      await this.page!.type('#username', email, { delay: 80 + Math.random() * 40 });
      await sleep(500 + Math.random() * 500);
      await this.page!.type('#password', password, { delay: 60 + Math.random() * 30 });
      await sleep(300 + Math.random() * 300);
      await this.page!.click('[type="submit"]');
      console.log('[LinkedInSession] Credentials submitted. Waiting for redirect...');
    } catch (err) {
      console.log('[LinkedInSession] Auto-login failed, falling back to manual login.');
    }

    const waitTime = 120000;
    const checkInterval = 3000;
    let elapsed = 0;

    while (elapsed < waitTime) {
      await sleep(checkInterval);
      elapsed += checkInterval;

      if (await this._checkLoggedIn()) {
        this.loggedIn = true;
        console.log('[LinkedInSession] Login detected successfully.');
        await this._saveCookies();
        return;
      }

      const currentUrl = this.page!.url();
      if (currentUrl.includes('feed') || currentUrl.includes('check/point')) {
        this.loggedIn = true;
        console.log('[LinkedInSession] Login detected via URL change.');
        await this._saveCookies();
        return;
      }

      if (elapsed % 15000 === 0) {
        console.log(`[LinkedInSession] Waiting for login... ${Math.round(elapsed / 1000)}s elapsed`);
      }
    }

    throw new Error('[LinkedInSession] Login timeout reached (120s). Please restart the bot and try again.');
  }

  private async _saveCookies(): Promise<void> {
    try {
      const cookies = await this.page!.cookies();
      const cookiesStr = JSON.stringify(cookies, null, 2);
      const dir = path.dirname(COOKIE_PATH);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(COOKIE_PATH, cookiesStr, 'utf-8');
      console.log('[LinkedInSession] Cookies saved to file successfully.');
      // Mostrar cookies en consola para facilitar copiarlas a Render
      console.log('[LinkedInSession] === COPY BELOW FOR LINKEDIN_COOKIES ENV VAR ===');
      console.log(cookiesStr);
      console.log('[LinkedInSession] === END COOKIES ===');
    } catch (err) {
      console.error('[LinkedInSession] Failed to save cookies:', err);
    }
  }

  private async _navigateWithRetry(url: string, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await this.page!.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        await this._randomDelay(1000, 2000);
        return;
      } catch (err) {
        console.log(`[LinkedInSession] Navigation attempt ${i + 1} failed. Retrying...`);
        if (i === retries - 1) throw err;
        await sleep(3000);
      }
    }
  }

  async navigate(url: string): Promise<void> {
    await this._navigateWithRetry(url);
  }

  async getPage(): Promise<Page> {
    return this.page!;
  }

  async isLoggedIn(): Promise<boolean> {
    return this.loggedIn;
  }

  async refreshSession(): Promise<void> {
    await this._navigateWithRetry('https://www.linkedin.com/feed/', 2);
    this.loggedIn = await this._checkLoggedIn();
    if (!this.loggedIn) {
      console.log('[LinkedInSession] Session lost. Initiating re-login...');
      await this._manualLogin();
    }
  }

  async _randomDelay(minMs = 1000, maxMs = 3000): Promise<void> {
    const delay = minMs + Math.random() * (maxMs - minMs);
    await sleep(delay);
  }

  async close(): Promise<void> {
    if (this.loggedIn) {
      await this._saveCookies();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}
