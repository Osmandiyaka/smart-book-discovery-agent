import { Request, Response } from 'express';
import { JobService } from '../../services/job.service';
import { ApiResponse } from '../../models/response.model';
import { Logger } from '../../utils/logger';

export class JobController {
    private jobService: JobService;

    constructor() {
        this.jobService = new JobService();
    }

    startScraping = async (req: Request, res: Response): Promise<void> => {
        try {
            const { theme } = req.body;

            if (!theme || typeof theme !== 'string') {
                const response: ApiResponse<null> = {
                    success: false,
                    error: 'Theme is required and must be a string'
                };
                res.status(400).json(response);
                return;
            }

            const job = await this.jobService.createJob(theme);

            const response: ApiResponse<{ jobId: string }> = {
                success: true,
                data: { jobId: job.id },
                message: `Job created successfully. Use /status/${job.id} to check the status.`
            };

            res.status(202).json(response);
        } catch (error) {
            Logger.error(`Error in startScraping: ${(error as Error).message}`);

            const response: ApiResponse<null> = {
                success: false,
                error: `Failed to start job: ${(error as Error).message}`
            };

            res.status(500).json(response);
        }
    };

    getJobStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const { jobId } = req.params;
            const job = await this.jobService.getJob(jobId);

            if (!job) {
                const response: ApiResponse<null> = {
                    success: false,
                    error: `Job with ID ${jobId} not found`
                };
                res.status(404).json(response);
                return;
            }

            const response: ApiResponse<{ status: string; createdAt: Date; updatedAt: Date; error?: string }> = {
                success: true,
                data: {
                    status: job.status,
                    createdAt: job.createdAt,
                    updatedAt: job.updatedAt,
                    ...(job.error && { error: job.error })
                }
            };

            res.status(200).json(response);
        } catch (error) {
            Logger.error(`Error in getJobStatus: ${(error as Error).message}`);

            const response: ApiResponse<null> = {
                success: false,
                error: `Failed to get job status: ${(error as Error).message}`
            };

            res.status(500).json(response);
        }
    };

    getJobResults = async (req: Request, res: Response): Promise<void> => {
        try {
            const { jobId } = req.params;
            const job = await this.jobService.getJob(jobId);

            if (!job) {
                const response: ApiResponse<null> = {
                    success: false,
                    error: `Job with ID ${jobId} not found`
                };
                res.status(404).json(response);
                return;
            }

            if (job.status !== 'completed') {
                const response: ApiResponse<null> = {
                    success: false,
                    error: `Job with ID ${jobId} is not completed yet. Current status: ${job.status}`
                };
                res.status(400).json(response);
                return;
            }

            const response: ApiResponse<{
                theme: string;
                books: any[];

            }> = {
                success: true,
                data: {
                    theme: job.theme,
                    books: job.enrichedBooks || [],
                }
            };

            res.status(200).json(response);
        } catch (error) {
            Logger.error(`Error in getJobResults: ${(error as Error).message}`);

            const response: ApiResponse<null> = {
                success: false,
                error: `Failed to get job results: ${(error as Error).message}`
            };

            res.status(500).json(response);
        }
    };

}