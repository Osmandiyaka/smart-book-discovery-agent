// src/services/browser-pool.service.ts
import { Browser, chromium, Page } from 'playwright';
import { Logger } from '../utils/logger';

interface BrowserInstance {
    id: string;
    browser: Browser;
    inUse: boolean;
    createdAt: Date;
    lastUsed: Date;
}

export class BrowserPoolService {
    private static instance: BrowserPoolService;
    private browsers: Map<string, BrowserInstance> = new Map();
    private readonly maxBrowsers: number;
    private readonly maxIdleTime: number;
    private readonly cleanupInterval: NodeJS.Timeout;

    private constructor() {
        this.maxBrowsers = parseInt(process.env.MAX_BROWSERS || '3');
        this.maxIdleTime = parseInt(process.env.BROWSER_IDLE_TIME || '300000'); // 5 minutes

        // Cleanup idle browsers every 2 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleBrowsers();
        }, 120000);

        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
        process.on('beforeExit', () => this.shutdown());
    }

    public static getInstance(): BrowserPoolService {
        if (!BrowserPoolService.instance) {
            BrowserPoolService.instance = new BrowserPoolService();
        }
        return BrowserPoolService.instance;
    }

    async getBrowser(): Promise<{ browser: Browser; browserId: string }> {
        // Try to find an available browser
        for (const [id, instance] of this.browsers) {
            if (!instance.inUse && instance.browser.isConnected()) {
                instance.inUse = true;
                instance.lastUsed = new Date();
                Logger.debug(`Reusing browser ${id}`);
                return { browser: instance.browser, browserId: id };
            }
        }

        // Create new browser if under limit
        if (this.browsers.size < this.maxBrowsers) {
            const browserId = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const browser = await this.createBrowser();

            const instance: BrowserInstance = {
                id: browserId,
                browser,
                inUse: true,
                createdAt: new Date(),
                lastUsed: new Date(),
            };

            this.browsers.set(browserId, instance);
            Logger.info(`Created new browser ${browserId}. Total browsers: ${this.browsers.size}`);

            return { browser, browserId };
        }

        // Wait for available browser
        Logger.warn('All browsers in use, waiting for available browser...');
        return this.waitForAvailableBrowser();
    }

    async releaseBrowser(browserId: string): Promise<void> {
        const instance = this.browsers.get(browserId);
        if (instance) {
            instance.inUse = false;
            instance.lastUsed = new Date();
            Logger.debug(`Released browser ${browserId}`);
        } else {
            Logger.warn(`Attempted to release unknown browser ${browserId}`);
        }
    }

    private async createBrowser(): Promise<Browser> {
        try {
            const browser = await chromium.launch({
                headless: true,
                executablePath: process.env.CHROME_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--memory-pressure-off', // Reduce memory pressure
                    '--max_old_space_size=2048', // Limit memory usage
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images', // Speed up loading if images not needed
                    '--disable-javascript', // Uncomment if JS not needed for scraping
                ],
            });

            // Handle browser disconnection
            browser.on('disconnected', () => {
                Logger.warn('Browser disconnected unexpectedly');
                this.removeBrowser(browser);
            });


            return browser;
        } catch (error) {
            Logger.error('Failed to create browser:', error);
            throw new Error(`Failed to create browser: ${(error as Error).message}`);
        }
    }

    private async waitForAvailableBrowser(): Promise<{ browser: Browser; browserId: string }> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for available browser'));
            }, 30000); // 30 second timeout

            const checkAvailable = async () => {
                try {
                    // Check for available browsers
                    for (const [id, instance] of this.browsers) {
                        if (!instance.inUse && instance.browser.isConnected()) {
                            clearTimeout(timeout);
                            instance.inUse = true;
                            instance.lastUsed = new Date();
                            resolve({ browser: instance.browser, browserId: id });
                            return;
                        }
                    }

                    // Check again in 1 second
                    setTimeout(checkAvailable, 1000);
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            checkAvailable();
        });
    }

    private async cleanupIdleBrowsers(): Promise<void> {
        const now = new Date();
        const browsersToRemove: string[] = [];

        for (const [id, instance] of this.browsers) {
            const idleTime = now.getTime() - instance.lastUsed.getTime();

            // Remove browsers that are idle and not in use
            if (!instance.inUse && idleTime > this.maxIdleTime) {
                browsersToRemove.push(id);
            }

            // Also remove disconnected browsers
            if (!instance.browser.isConnected()) {
                browsersToRemove.push(id);
            }
        }

        for (const id of browsersToRemove) {
            const instance = this.browsers.get(id);
            if (instance) {
                try {
                    if (instance.browser.isConnected()) {
                        await instance.browser.close();
                    }
                    this.browsers.delete(id);
                    Logger.info(`Cleaned up idle browser ${id}`);
                } catch (error) {
                    Logger.error(`Error closing browser ${id}:`, error);
                    // Remove from map even if closing failed
                    this.browsers.delete(id);
                }
            }
        }

        if (browsersToRemove.length > 0) {
            Logger.info(`Cleaned up ${browsersToRemove.length} browsers. Active browsers: ${this.browsers.size}`);
        }
    }

    private removeBrowser(browser: Browser): void {
        for (const [id, instance] of this.browsers) {
            if (instance.browser === browser) {
                this.browsers.delete(id);
                Logger.info(`Removed disconnected browser ${id}`);
                break;
            }
        }
    }

    async getPoolStats(): Promise<{
        total: number;
        inUse: number;
        available: number;
        maxBrowsers: number;
        memoryUsage: NodeJS.MemoryUsage;
    }> {
        let inUse = 0;
        let available = 0;
        let disconnected = 0;

        for (const instance of this.browsers.values()) {
            if (instance.browser.isConnected()) {
                if (instance.inUse) {
                    inUse++;
                } else {
                    available++;
                }
            } else {
                disconnected++;
            }
        }

        return {
            total: this.browsers.size,
            inUse,
            available,
            maxBrowsers: this.maxBrowsers,
            memoryUsage: process.memoryUsage(),
        };
    }

    async warmUp(): Promise<void> {
        Logger.info('Warming up browser pool...');

        try {
            // Create one browser to warm up the pool
            const { browser, browserId } = await this.getBrowser();

            // Test the browser with a simple page
            const context = await browser.newContext();
            const page = await context.newPage();
            await page.goto('about:blank');
            await context.close();

            await this.releaseBrowser(browserId);
            Logger.info('Browser pool warmed up successfully');

        } catch (error) {
            Logger.error('Failed to warm up browser pool:', error);
        }
    }

    async shutdown(): Promise<void> {
        Logger.info('Shutting down browser pool...');

        // Clear the cleanup interval
        clearInterval(this.cleanupInterval);

        // Close all browsers
        const closePromises = Array.from(this.browsers.values()).map(async (instance) => {
            try {
                if (instance.browser.isConnected()) {
                    await instance.browser.close();
                }
            } catch (error) {
                Logger.error(`Error closing browser ${instance.id}:`, error);
            }
        });

        await Promise.allSettled(closePromises);
        this.browsers.clear();

        Logger.info('Browser pool shutdown complete');
    }

    // Force close a specific browser (useful for debugging)
    async closeBrowser(browserId: string): Promise<boolean> {
        const instance = this.browsers.get(browserId);
        if (!instance) {
            Logger.warn(`Browser ${browserId} not found`);
            return false;
        }

        try {
            if (instance.browser.isConnected()) {
                await instance.browser.close();
            }
            this.browsers.delete(browserId);
            Logger.info(`Manually closed browser ${browserId}`);
            return true;
        } catch (error) {
            Logger.error(`Failed to close browser ${browserId}:`, error);
            return false;
        }
    }

    // Get detailed browser information
    async getBrowserDetails(): Promise<Array<{
        id: string;
        inUse: boolean;
        createdAt: Date;
        lastUsed: Date;
        isConnected: boolean;
        idleTime: number;
    }>> {
        const now = new Date();
        const details = [];

        for (const [id, instance] of this.browsers) {
            details.push({
                id,
                inUse: instance.inUse,
                createdAt: instance.createdAt,
                lastUsed: instance.lastUsed,
                isConnected: instance.browser.isConnected(),
                idleTime: now.getTime() - instance.lastUsed.getTime(),
            });
        }

        return details;
    }

    // Health check method
    async healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        totalBrowsers: number;
        activeBrowsers: number;
        issues: string[];
    }> {
        const issues: string[] = [];
        let activeBrowsers = 0;

        for (const [id, instance] of this.browsers) {
            if (instance.browser.isConnected()) {
                activeBrowsers++;
            } else {
                issues.push(`Browser ${id} is disconnected`);
            }
        }

        const totalBrowsers = this.browsers.size;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        if (issues.length > 0) {
            status = issues.length === totalBrowsers ? 'unhealthy' : 'degraded';
        }

        if (totalBrowsers === 0) {
            issues.push('No browsers in pool');
            status = 'degraded';
        }

        return {
            status,
            totalBrowsers,
            activeBrowsers,
            issues,
        };
    }
}