import { Queue, Worker, Job as BullJob } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Job, JobStatus } from '../models/job.model';
import { BookData, EnrichedBookData } from '../models/book.model';
import { ScraperService } from './scraper.service';
import { EnrichmentService } from './enrichment.service';
import { IntegrationService } from './integration.service';
import { Logger } from '../utils/logger';
import IORedis from 'ioredis';

const connection = new IORedis({
    maxRetriesPerRequest: null,
});

export class JobService {
    private queue: Queue<Job>;
    private scraperService: ScraperService;
    private enrichmentService: EnrichmentService;
    private integrationService: IntegrationService;

    constructor() {
        this.queue = new Queue<Job>('jobQueue', { connection });
        this.scraperService = new ScraperService();
        this.enrichmentService = new EnrichmentService();
        this.integrationService = new IntegrationService();

        // Setup worker to process jobs
        new Worker<Job>('jobQueue', async (bullJob: BullJob<Job>) => {
            await this.processJob(bullJob.data);
        }, { connection });
    }

    async createJob(theme: string): Promise<Job> {
        const jobId = uuidv4();
        const now = new Date();

        const job: Job = {
            id: jobId,
            theme,
            status: JobStatus.PENDING,
            createdAt: now,
            updatedAt: now
        };

        // await this.queue.add(jobId, job);
        await this.queue.add(jobId, job, { jobId })
        return job;
    }

    async getJob(jobId: string): Promise<Job | null> {
        const bullJob = await this.queue.getJob(jobId);
        return bullJob?.data || null;
    }

    private async processJob(job: Job): Promise<void> {
        const jobId = job.id;
        const now = () => new Date();
        const bullJob: BullJob | undefined = await this.queue.getJob(jobId);
        try {
            // Update: SCRAPING
            job.status = JobStatus.SCRAPING;
            job.updatedAt = now();
            const books: BookData[] = await this.scraperService.scrapeBooksByTheme(job.theme);
            job.books = books;

            // Update: ENRICHING
            job.status = JobStatus.ENRICHING;
            job.updatedAt = now();
            const enrichedBooks: EnrichedBookData[] = await this.enrichmentService.enrichBooks(books, job.theme);
            job.enrichedBooks = enrichedBooks;

            // Update: INTEGRATING
            job.status = JobStatus.INTEGRATING;
            job.updatedAt = now();
            await this.integrationService.sendToMakecom(enrichedBooks, job.theme);

            // Finalize
            job.status = JobStatus.COMPLETED;
            job.updatedAt = now();
            await bullJob?.updateData(job);
        } catch (error) {
            job.status = JobStatus.FAILED;
            job.updatedAt = now();
            job.error = (error as Error).message;
            Logger.error(`Job ${jobId} failed: ${job.error}`, { jobId, error });
            await bullJob?.updateData(job);
        }
    }
}
