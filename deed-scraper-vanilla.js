/**
 * Prior Deed Scraper Module - Vanilla Puppeteer Version
 *
 * This version uses regular Puppeteer instead of puppeteer-extra to avoid
 * bot detection signatures that may be added by stealth plugins.
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class DeedScraperVanilla {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.timeout = options.timeout || 60000;
    this.headless = options.headless !== undefined ? options.headless : true;
    this.verbose = options.verbose || false;
    this.twoCaptchaToken = process.env.TWOCAPTCHA_TOKEN;
  }

  /**
   * Initialize browser with minimal anti-detection
   */
  async initialize() {
    this.log('🚀 Initializing browser (vanilla Puppeteer)...');

    const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
    const isLinux = process.platform === 'linux';

    const executablePath = isRailway || isLinux
      ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
      : undefined;

    this.browser = await puppeteer.launch({
      headless: this.headless,
      ...(executablePath && { executablePath }),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1366,768'
      ]
    });

    this.page = await this.browser.newPage();

    // Minimal anti-detection - just hide webdriver
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      delete navigator.__proto__.webdriver;
    });

    // Set user agent
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set viewport
    await this.page.setViewport({ width: 1366, height: 768 });

    // Set timeouts
    this.page.setDefaultNavigationTimeout(this.timeout);
    this.page.setDefaultTimeout(this.timeout);

    this.log('✅ Browser initialized');
  }

  /**
   * Manually solve reCAPTCHA using 2Captcha API
   */
  async solveCaptchaManually(siteKey, pageUrl) {
    if (!this.twoCaptchaToken) {
      throw new Error('2Captcha token not configured');
    }

    this.log('🔧 Solving reCAPTCHA using 2Captcha API...');

    try {
      // Step 1: Submit CAPTCHA to 2Captcha
      const submitResponse = await axios.get('http://2captcha.com/in.php', {
        params: {
          key: this.twoCaptchaToken,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(`2Captcha submission failed: ${submitResponse.data.request}`);
      }

      const requestId = submitResponse.data.request;
      this.log(`📝 CAPTCHA submitted, request ID: ${requestId}`);

      // Step 2: Poll for result
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

        const resultResponse = await axios.get('http://2captcha.com/res.php', {
          params: {
            key: this.twoCaptchaToken,
            action: 'get',
            id: requestId,
            json: 1
          }
        });

        if (resultResponse.data.status === 1) {
          this.log('✅ reCAPTCHA solved!');
          return resultResponse.data.request; // This is the g-recaptcha-response token
        }

        if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2Captcha error: ${resultResponse.data.request}`);
        }

        attempts++;
      }

      throw new Error('2Captcha timeout waiting for solution');

    } catch (error) {
      this.log(`❌ CAPTCHA solving failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect and solve reCAPTCHA on page
   */
  async handleCaptchaIfPresent() {
    try {
      // Check if reCAPTCHA is present
      const captchaFrame = this.page.frames().find(frame =>
        frame.url().includes('google.com/recaptcha/api2/anchor') ||
        frame.url().includes('google.com/recaptcha/enterprise/anchor')
      );

      if (!captchaFrame) {
        return false; // No CAPTCHA
      }

      this.log('⚠️ reCAPTCHA detected');

      // Get site key and page URL
      const siteKey = await this.page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="google.com/recaptcha"]');
        if (iframe) {
          const src = iframe.getAttribute('src');
          const match = src.match(/[?&]k=([^&]+)/);
          return match ? match[1] : null;
        }
        return null;
      });

      if (!siteKey) {
        throw new Error('Could not find reCAPTCHA site key');
      }

      const pageUrl = this.page.url();

      // Solve CAPTCHA
      const captchaToken = await this.solveCaptchaManually(siteKey, pageUrl);

      // Inject solution
      await this.page.evaluate((token) => {
        document.getElementById('g-recaptcha-response').innerHTML = token;
        if (typeof ___grecaptcha_cfg !== 'undefined') {
          const recaptchaId = Object.keys(___grecaptcha_cfg.clients)[0];
          ___grecaptcha_cfg.clients[recaptchaId].callback(token);
        }
      }, captchaToken);

      this.log('✅ reCAPTCHA solution injected');
      return true;

    } catch (error) {
      this.log(`⚠️ Error handling CAPTCHA: ${error.message}`);
      return false;
    }
  }

  log(message) {
    if (this.verbose) {
      console.log(message);
    }
  }

  async randomWait(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.log('Browser closed');
    }
  }
}

module.exports = DeedScraperVanilla;
