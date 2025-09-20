// regrid-scraper-render.js - Optimized for Render.com deployment
const puppeteer = require('puppeteer-core'); // Changed from 'puppeteer' to 'puppeteer-core'

class RegridScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cookies = null;
        this.csrfToken = null;
    }

    async initialize() {
        console.log('Initializing browser on Render...');
        
        // Browser launch configuration for Render.com using puppeteer-core
        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--metrics-recording-only',
                '--no-default-browser-check',
                '--no-pings',
                '--password-store=basic',
                '--use-mock-keychain'
            ]
        };

        // For Render, try these Chrome paths in order
        const chromePaths = [
            process.env.GOOGLE_CHROME_BIN,
            process.env.CHROME_BIN,
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/snap/bin/chromium'
        ].filter(Boolean);

        let browserLaunched = false;
        let lastError = null;

        // Try each Chrome path
        for (const chromePath of chromePaths) {
            try {
                console.log(`Trying Chrome at: ${chromePath}`);
                launchOptions.executablePath = chromePath;
                this.browser = await puppeteer.launch(launchOptions);
                console.log(`Successfully launched Chrome from: ${chromePath}`);
                browserLaunched = true;
                break;
            } catch (error) {
                console.log(`Failed to launch Chrome from ${chromePath}:`, error.message);
                lastError = error;
            }
        }

        // If no specific path worked, try without executablePath (let system find Chrome)
        if (!browserLaunched) {
            try {
                console.log('Trying to launch Chrome without specific path...');
                delete launchOptions.executablePath;
                this.browser = await puppeteer.launch(launchOptions);
                console.log('Successfully launched Chrome using system default');
                browserLaunched = true;
            } catch (error) {
                console.log('Failed to launch Chrome with system default:', error.message);
                lastError = error;
            }
        }

        if (!browserLaunched) {
            throw new Error(`Could not launch Chrome. Last error: ${lastError?.message}`);
        }

        this.page = await this.browser.newPage();

        // Set realistic viewport and user agent
        await this.page.setViewport({ width: 1366, height: 768 });
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');

        // Set extra headers
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd'
        });

        console.log('Browser initialized successfully');
    }

    // ... rest of your methods remain the same ...