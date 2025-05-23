import { v4 as uuidv4 } from 'uuid';
import { Job, JobStatus } from '../models/job.model';
import { BookData, EnrichedBookData } from '../models/book.model';
import { ScraperService } from './scraper.service';
import { EnrichmentService } from './enrichment.service';
import { IntegrationService } from './integration.service';
import { Logger } from '../utils/logger';

export class JobService {
    private jobs: Map<string, Job> = new Map();
    private scraperService: ScraperService;
    private enrichmentService: EnrichmentService;
    private integrationService: IntegrationService;

    constructor() {
        this.scraperService = new ScraperService();
        this.enrichmentService = new EnrichmentService();
        this.integrationService = new IntegrationService();
    }

    createJob(theme: string): Job {
        const jobId = uuidv4();
        const job: Job = {
            id: jobId,
            theme,
            status: JobStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.jobs.set(jobId, job);

        this.processJob(jobId).catch(error => {
            Logger.error(`Job ${jobId} failed: ${error.message}`, { jobId, error });
            this.updateJobStatus(jobId, JobStatus.FAILED, error.message);
        });

        return job;
    }

    getJob(jobId: string): Job | undefined {
        return this.jobs.get(jobId);
    }

    private async processJob(jobId: string): Promise<void> {
        try {
            const job = this.jobs.get(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }

            // Step 1: Scraping
            this.updateJobStatus(jobId, JobStatus.SCRAPING);
            const books = await this.scraperService.scrapeBooksByTheme(job.theme);
            this.updateJobBooks(jobId, books);

            // Step 2: AI Enrichment
            this.updateJobStatus(jobId, JobStatus.ENRICHING);
            const enrichedBooks = await this.enrichmentService.enrichBooks(books, job.theme);
            this.updateJobEnrichedBooks(jobId, enrichedBooks);

            // Step 3: Make.com Integration
            this.updateJobStatus(jobId, JobStatus.INTEGRATING);
            await this.integrationService.sendToMakecom(enrichedBooks, job.theme);

            // Mark as completed
            this.updateJobStatus(jobId, JobStatus.COMPLETED);
        } catch (error) {
            this.updateJobStatus(jobId, JobStatus.FAILED, (error as Error).message);
            throw error;
        }
    }

    private updateJobStatus(jobId: string, status: JobStatus, error?: string): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = status;
            job.updatedAt = new Date();
            if (error) {
                job.error = error;
            }
            this.jobs.set(jobId, job);
        }
    }

    private updateJobBooks(jobId: string, books: BookData[]): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.books = books;
            job.updatedAt = new Date();
            this.jobs.set(jobId, job);
        }
    }

    private updateJobEnrichedBooks(jobId: string, enrichedBooks: EnrichedBookData[]): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.enrichedBooks = enrichedBooks;
            job.updatedAt = new Date();
            this.jobs.set(jobId, job);
        }
    }
}