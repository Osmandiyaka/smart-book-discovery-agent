import { BookData } from '../models/book.model';
import { AppError } from '../utils/error-handler';
import { Logger } from '../utils/logger';
import { chromium } from 'playwright';

export class ScraperService {
    async scrapeBooksByTheme(theme: string): Promise<BookData[]> {
        Logger.info(`Starting scraping for theme: ${theme}`);

        const browser = await chromium.launch({
            headless: true,
            executablePath: process.env.CHROME_PATH || undefined
        });

        const context = await browser.newContext();
        const page = await context.newPage();
        const books: BookData[] = [];

        try {
            await page.goto(`https://bookdp.com.au/?s=${encodeURIComponent(theme)}&post_type=product`, {
                waitUntil: 'networkidle',
                timeout: 60000
            });

            await page.waitForSelector('.product.type-product', { timeout: 30000 });

            const firstPageBooks = await this.scrapeCurrentPage(page);
            books.push(...firstPageBooks);

            const hasNextPage = await page.$('.pagination-next, .next.page-numbers');
            if (hasNextPage) {
                await page.click('.pagination-next, .next.page-numbers');
                await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForSelector('.product.type-product', { timeout: 30000 });

                const secondPageBooks = await this.scrapeCurrentPage(page);
                books.push(...secondPageBooks);
            }

            return books;
        } catch (error) {
            Logger.error(`Error while scraping: ${(error as Error).message}`);
            throw new AppError(`Failed to scrape books: ${(error as Error).message}`, 500);
        } finally {
            await browser.close();
        }
    }

    private async scrapeCurrentPage(page: any): Promise<BookData[]> {
        // First, get all product URLs from the list page
        const productUrls = await page.evaluate(() => {
            const bookElements = document.querySelectorAll('.product.type-product');
            const urls: string[] = [];

            bookElements.forEach((element) => {
                const titleElement = element.querySelector('.woocommerce-loop-product__title a');
                if (titleElement) {
                    const url = titleElement.getAttribute('href');
                    if (url) urls.push(url);
                }
            });

            return urls;
        });

        // Then visit each product page to get detailed information
        const books: BookData[] = [];

        for (const url of productUrls) {
            try {
                // Navigate to the product detail page
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

                // Extract detailed information from the product page
                const bookData = await page.evaluate(() => {
                    try {
                        // Extract title
                        const title = document.querySelector('.product_title')?.textContent?.trim() || '';

                        // Extract price information
                        const currentPriceElement = document.querySelector('.price ins .woocommerce-Price-amount');
                        let currentPriceText = currentPriceElement?.textContent?.trim() || '';
                        currentPriceText = currentPriceText.replace(/[^\d.]/g, '');
                        const currentPrice = parseFloat(currentPriceText) || 0;

                        const originalPriceElement = document.querySelector('.price del .woocommerce-Price-amount');
                        let originalPrice;
                        if (originalPriceElement) {
                            let originalPriceText = originalPriceElement.textContent?.trim() || '';
                            originalPriceText = originalPriceText.replace(/[^\d.]/g, '');
                            originalPrice = parseFloat(originalPriceText) || undefined;
                        }

                        // Extract description
                        const shortDescription = document.querySelector('.woocommerce-product-details__short-description')?.textContent?.trim() || '';

                        // Try to get more detailed info from meta
                        const metaRows = document.querySelectorAll('.short-description table tr');
                        let author = '';
                        let description = shortDescription;

                        if (metaRows.length > 0) {
                            const metaInfo: string[] = [];
                            metaRows.forEach(row => {
                                const label = row.querySelector('th')?.textContent?.trim() || '';
                                const value = row.querySelector('td')?.textContent?.trim() || '';

                                if (label && value) {
                                    // Try to find author-related info
                                    if (label.toLowerCase().includes('author')) {
                                        author = value;
                                    }

                                    metaInfo.push(`${label}: ${value}`);
                                }
                            });

                            if (metaInfo.length > 0) {
                                description = metaInfo.join('. ');
                            }
                        }

                        return {
                            title,
                            author,
                            currentPrice,
                            originalPrice,
                            description,
                            productUrl: window.location.href
                        };
                    } catch (err) {
                        console.error('Error extracting product details:', err);
                        return null;
                    }
                });

                if (bookData && bookData.title && bookData.currentPrice > 0) {
                    books.push(bookData);
                }
            } catch (error) {
                console.error(`Error processing product page ${url}: ${error}`);
            }
        }

        return books;
    }
}