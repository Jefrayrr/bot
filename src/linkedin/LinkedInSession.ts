import puppeteer, { Browser, Page } from 'puppeteer';
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

    this.browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
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
    });

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
    try {
      const cookiesJson = await fs.readFile(COOKIE_PATH, 'utf-8');
      const cookies = JSON.parse(cookiesJson);
      if (cookies.length > 0) {
        await this.page!.setCookie(...cookies);
        console.log('[LinkedInSession] Cookies restored from file.');
      }
    } catch {
      console.log('[LinkedInSession] No saved cookies found.');
      return;
    }

    await this._navigateWithRetry('https://www.linkedin.com/feed/', 2);
    await sleep(3000);

    const isLoggedIn = await this._checkLoggedIn();
    if (isLoggedIn) {
      this.loggedIn = true;
      console.log('[LinkedInSession] Session restored successfully.');
    } else {
      console.log('[LinkedInSession] Session expired, re-login required.');
    }
  }

  private async _checkLoggedIn(): Promise<boolean> {
    try {
      const url = this.page!.url();
      if (url.includes('login') || url.includes('checkpoint')) return false;

      const feedIndicator = await this.page!.$('div[data-feed-context]');
      if (feedIndicator) return true;

      const navProfile = await this.page!.$('.global-nav__me-photo');
      if (navProfile) return true;

      return false;
    } catch {
      return false;
    }
  }

  private async _manualLogin(): Promise<void> {
    console.log('[LinkedInSession] Please log in manually in the browser window.');
    console.log('[LinkedInSession] You have 120 seconds to complete the login.');

    await this._navigateWithRetry('https://www.linkedin.com/login', 2);

    const email = process.env.LINKEDIN_EMAIL;
    const password = process.env.LINKEDIN_PASSWORD;

    if (email && password) {
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
      const dir = path.dirname(COOKIE_PATH);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2), 'utf-8');
      console.log('[LinkedInSession] Cookies saved successfully.');
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
