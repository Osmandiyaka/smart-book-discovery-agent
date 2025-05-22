import { BookData, EnrichedBookData } from '../models/book.model';
import { Logger } from '../utils/logger';
import { OpenAIApi } from 'openai';
import { openaiConfig } from '../config/openai';

export class EnrichmentService {
    private openai: OpenAIApi;

    constructor() {
        this.openai = new OpenAIApi(openaiConfig);
    }

    async enrichBooks(books: BookData[], theme: string): Promise<EnrichedBookData[]> {
        Logger.info(`Starting AI enrichment for ${books.length} books`);

        const enrichedBooks: EnrichedBookData[] = [];

        for (const book of books) {
            try {
                const summary = await this.generateSummary(book.description);

                const relevanceScore = await this.calculateRelevanceScore(book.description, theme);

                let discountAmount: number | undefined;
                let discountPercentage: number | undefined;

                if (book.originalPrice && book.originalPrice > book.currentPrice) {
                    discountAmount = book.originalPrice - book.currentPrice;
                    discountPercentage = (discountAmount / book.originalPrice) * 100;
                }

                const valueScore = relevanceScore / book.currentPrice;

                enrichedBooks.push({
                    ...book,
                    summary,
                    relevanceScore,
                    discountAmount,
                    discountPercentage,
                    valueScore
                });

                Logger.debug(`Enriched book: ${book.title}`);
            } catch (error) {
                Logger.error(`Error enriching book ${book.title}: ${(error as Error).message}`);
            }
        }

        Logger.info(`Completed AI enrichment for ${enrichedBooks.length} books`);
        return enrichedBooks;
    }

    private async generateSummary(description: string): Promise<string> {
        const prompt = `
      Summarize the following book description in 1-2 sentences:
      
      "${description}"
      
      Summary:
    `;

        const response = await this.openai.createCompletion({
            model: "gpt-4.1",
            prompt,
            max_tokens: 100,
            temperature: 0.5,
        });

        return response.data.choices[0].text?.trim() || "No summary available.";
    }

    private async calculateRelevanceScore(description: string, theme: string): Promise<number> {
        const prompt = `
      On a scale from 0 to 100, how relevant is the following book description to the theme "${theme}"?
      
      Book description: "${description}"
      
      Relevance score (just provide a number from 0 to 100):
    `;

        const response = await this.openai.createCompletion({
            model: "gpt-4.1",
            prompt,
            max_tokens: 10,
            temperature: 0.3,
        });

        const scoreText = response.data.choices[0].text?.trim() || "0";
        const score = parseInt(scoreText.replace(/\D/g, ''));

        return Math.min(Math.max(score, 0), 100);
    }
}