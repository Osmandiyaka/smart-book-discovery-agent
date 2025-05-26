import { BookData } from '../models/book.model';
import { AppError } from '../utils/error-handler';
import { Logger } from '../utils/logger';
import { Browser, Page } from 'playwright';
import { BrowserPoolService } from './browser-pool.service';

export class ScraperService {
    private browserPool: BrowserPoolService;
    constructor() {
        this.browserPool = BrowserPoolService.getInstance();
    }
    async scrapeBooksByTheme(theme: string): Promise<BookData[]> {
        Logger.info(`Scraping books for theme: ${theme}`);

        let browserId: string | null = null;
        let browser: Browser | null = null;

        try {
            const browserInstance = await this.browserPool.getBrowser();
            browser = browserInstance.browser;
            browserId = browserInstance.browserId;

            const books: BookData[] = [];

            const context = await browser.newContext();

            const page = await context.newPage();

            try {
                await this.searchForTheme(page, theme);
                books.push(...await this.scrapeCurrentPage(page));

                if (await this.hasNextPage(page)) {
                    await this.goToNextPage(page);
                    books.push(...await this.scrapeCurrentPage(page));
                }

                return books;
            } finally {
                await context.close();
            }

        } catch (error) {
            Logger.error(`Scraping failed: ${(error as Error).message}`);
            throw new AppError(`Failed to scrape books: ${(error as Error).message}`, 500);
        } finally {
            if (browserId) {
                await this.browserPool.releaseBrowser(browserId);
            }
        }
    }

    private async searchForTheme(page: Page, theme: string): Promise<void> {
        const url = `https://bookdp.com.au/?s=${encodeURIComponent(theme)}&post_type=product`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForSelector('.product.type-product', { timeout: 30000 });
    }

    private async hasNextPage(page: Page): Promise<boolean> {
        return !!(await page.$('.pagination-next, .next.page-numbers'));
    }

    private async goToNextPage(page: Page): Promise<void> {
        await page.click('.pagination-next, .next.page-numbers');
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForSelector('.product.type-product', { timeout: 30000 });
    }

    private async scrapeCurrentPage(page: Page): Promise<BookData[]> {
        const urls = await this.extractProductUrls(page);
        const books: BookData[] = [];

        for (const url of urls) {
            const book = await this.scrapeProductDetails(page, url);
            if (book) books.push(book);
        }

        return books;
    }

    private async extractProductUrls(page: Page): Promise<string[]> {
        return page.evaluate(() => {
            return Array.from(document.querySelectorAll('.product.type-product .woocommerce-loop-product__title a'))
                .map(el => el.getAttribute('href'))
                .filter((url): url is string => !!url);
        });
    }


    private async scrapeProductDetails(page: Page, url: string): Promise<BookData | null> {
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            return await page.evaluate(async () => {
                const getText = (selector: string): string =>
                    document.querySelector(selector)?.textContent?.trim() || '';

                const parsePrice = (selector: string): number | undefined => {
                    const text = getText(selector).replace(/[^\d.]/g, '');
                    const value = parseFloat(text);
                    return isNaN(value) ? undefined : value;
                };

                const extractPublisher = () => {
                    const rows = document.querySelectorAll('.short-description__content table tr');

                    for (const row of Array.from(rows)) {
                        const label = row.querySelector('th')?.textContent?.trim().toLowerCase();
                        if (label === 'publisher:') {
                            const value = row.querySelector('td')?.textContent?.trim();
                            return value || '';
                        }
                    }
                    return '';
                }

                const title = getText('.product_title');
                const currentPrice = parsePrice('.price ins .woocommerce-Price-amount') || 0;
                const originalPrice = parsePrice('.price del .woocommerce-Price-amount');

                const shortDesc = getText('.woocommerce-product-details__short-description');


                let author = await extractPublisher();
                let description = shortDesc;

                if (!title || currentPrice <= 0) return null;

                return {
                    title,
                    author,
                    currentPrice,
                    originalPrice,
                    description,
                    productUrl: window.location.href
                };
            });
        } catch (err) {
            Logger.warn(`Failed to scrape product at ${url}: ${(err as Error).message}`);
            return null;
        }
    }
}
