// src/services/integration.service.ts
import axios from 'axios';
import { EnrichedBookData } from '../models/book.model';
import { Logger } from '../utils/logger';
import { environment } from '../config/environment';
import { AppError } from '../utils/error-handler';

export class IntegrationService {
    async sendToMakecom(enrichedBooks: EnrichedBookData[], theme: string): Promise<void> {
        try {
            Logger.info(`Sending ${enrichedBooks.length} enriched books to Make.com webhook`);

            // Format the data in a structure Make.com can easily process
            const payload = {
                theme,
                timestamp: new Date().toISOString(),
                totalBooks: enrichedBooks.length,
                books: enrichedBooks.map(book => ({
                    title: book.title,
                    author: book.author || "Unknown",
                    currentPrice: book.currentPrice,
                    originalPrice: book.originalPrice || null,
                    description: book.description,
                    summary: book.summary,
                    relevanceScore: book.relevanceScore,
                    discountAmount: book.discountAmount || 0,
                    discountPercentage: book.discountPercentage || 0,
                    valueScore: book.valueScore,
                    productUrl: book.productUrl
                }))
            };

            // Add debug logging to see what's being sent
            Logger.debug(`Payload to Make.com: ${JSON.stringify(payload, null, 2).substring(0, 1000)}...`);

            // Send the data to Make.com with proper timeout and headers
            const response = await axios.post(environment.makecomWebhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            Logger.info(`Successfully sent data to Make.com webhook. Status: ${response.status}`);
        } catch (error) {
            // More detailed error logging
            if (axios.isAxiosError(error)) {
                Logger.error(`Error sending data to Make.com: ${error.message}`);
                Logger.error(`Status: ${error.response?.status}, Data: ${JSON.stringify(error.response?.data || {})}`);

                // Specific error handling based on status code
                if (error.response?.status === 400) {
                    throw new AppError(`Make.com webhook rejected the data format: ${JSON.stringify(error.response.data)}`, 400);
                } else if (error.response?.status === 401 || error.response?.status === 403) {
                    throw new AppError(`Authentication error with Make.com webhook. Check your webhook URL.`, 401);
                } else if (error.response?.status === 404) {
                    throw new AppError(`Make.com webhook URL not found. Verify the URL is correct.`, 404);
                }
                //  else if (error.response?.status >= 500) {
                //   throw new AppError(`Make.com server error. Try again later.`, 500);
                // }
            }

            // Generic error for non-Axios errors
            throw new AppError(`Failed to integrate with Make.com: ${(error as Error).message}`, 500);
        }
    }
}