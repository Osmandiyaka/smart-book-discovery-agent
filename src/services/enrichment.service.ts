import { BookData, EnrichedBookData } from '../models/book.model';
import { Logger } from '../utils/logger';
import { AIProvider } from '../providers/ai-provider.interface';
import { AIProviderFactory } from '../providers/ai-provider.factory';
import { aiConfig } from '../config/ai.config';

export class EnrichmentService {
    private aiProvider: AIProvider;

    constructor() {
        this.aiProvider = AIProviderFactory.create(aiConfig);
        const provider = process.env.AI_PROVIDER;
        const p = aiConfig;
        Logger.info(`EnrichmentService initialized with ${aiConfig.provider} provider`);
    }

    async enrichBooks(books: BookData[], theme: string): Promise<EnrichedBookData[]> {
        Logger.info(`Starting enrichment for ${books.length} books using ${aiConfig.provider}`);

        const enrichedBooks: EnrichedBookData[] = [];

        for (const book of books) {
            try {
                const summary = await this.generateSummary(book.description);
                const relevanceScore = await this.calculateRelevanceScore(book.description, theme);
                const { discountAmount, discountPercentage } = this.computeDiscount(book.originalPrice, book.currentPrice);
                const valueScore = this.calculateValueScore(relevanceScore, book.currentPrice);

                enrichedBooks.push({
                    ...book,
                    summary,
                    relevanceScore,
                    discountAmount,
                    discountPercentage,
                    valueScore,
                });

                Logger.debug(`Enriched book: ${book.title}`);
            } catch (error) {
                Logger.error(`Failed to enrich "${book.title}": ${(error as Error).message}`);
            }
        }

        Logger.info(`Enrichment completed for ${enrichedBooks.length} books`);
        return enrichedBooks;
    }

    private async generateSummary(description: string): Promise<string> {
        const prompt = `Summarize the following book description in 1-2 sentences:

"${description}"

Summary:`.trim();

        try {
            const response = await this.aiProvider.generateCompletion({
                prompt,
                maxTokens: 100,
                temperature: 0.5,
            });

            return response.text || "No summary available.";
        } catch (error) {
            Logger.warn(`Failed to generate summary, using fallback: ${(error as Error).message}`);
            return this.generateFallbackSummary(description);
        }
    }

    private async calculateRelevanceScore(description: string, theme: string): Promise<number> {
        const prompt = `On a scale from 0 to 100, how relevant is the following book description to the theme "${theme}"?

Book description: "${description}"

Relevance score (just provide a number from 0 to 100):`.trim();

        try {
            const response = await this.aiProvider.generateCompletion({
                prompt,
                maxTokens: 10,
                temperature: 0.3,
            });

            const scoreText = response.text || "0";
            const score = parseInt(scoreText.replace(/\D/g, ''), 10);

            return Math.min(Math.max(score, 0), 100);
        } catch (error) {
            Logger.warn(`Failed to calculate relevance score, using fallback: ${(error as Error).message}`);
            return this.generateFallbackRelevanceScore(description, theme);
        }
    }

    private generateFallbackSummary(description: string): string {
        const sentences = description.split(/[.!?]+/);
        if (sentences.length > 0 && sentences[0].length > 10) {
            return sentences[0].trim() + '.';
        }
        return description.length > 100
            ? description.substring(0, 97) + '...'
            : description;
    }

    private generateFallbackRelevanceScore(description: string, theme: string): number {
        const themeWords = theme.toLowerCase().split(/\s+/);
        const descWords = description.toLowerCase().split(/\s+/);

        let matches = 0;
        for (const themeWord of themeWords) {
            if (descWords.some(descWord => descWord.includes(themeWord) || themeWord.includes(descWord))) {
                matches++;
            }
        }

        return Math.min((matches / themeWords.length) * 100, 100);
    }

    private computeDiscount(originalPrice?: number, currentPrice?: number) {
        if (originalPrice && currentPrice && originalPrice > currentPrice) {
            const discountAmount = originalPrice - currentPrice;
            const discountPercentage = (discountAmount / originalPrice) * 100;
            return { discountAmount, discountPercentage };
        }
        return { discountAmount: undefined, discountPercentage: undefined };
    }

    private calculateValueScore(relevanceScore: number, currentPrice: number): number {
        return currentPrice > 0 ? relevanceScore / currentPrice : 0;
    }
}