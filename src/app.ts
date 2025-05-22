import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jobRoutes from './api/routes/job.routes';
import { AppError } from './utils/error-handler';
import { Logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/', jobRoutes);

app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    Logger.error(`Error: ${err.message}`, { stack: err.stack });

    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: err.message
        });
    } else {
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default app;