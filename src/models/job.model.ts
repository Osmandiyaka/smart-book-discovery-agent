import { BookData, EnrichedBookData } from "./book.model";

export enum JobStatus {
    PENDING = 'pending',
    SCRAPING = 'scraping',
    ENRICHING = 'enriching',
    ANALYZING = 'analyzing',
    INTEGRATING = 'integrating',
    COMPLETED = 'completed',
    FAILED = 'failed'
}

export interface Job {
    id: string;
    theme: string;
    status: JobStatus;
    books?: BookData[];
    enrichedBooks?: EnrichedBookData[];
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}