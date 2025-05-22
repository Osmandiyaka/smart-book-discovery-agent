import { Router } from 'express';
import { JobController } from '../controllers/job.controller';

const router = Router();
const jobController = new JobController();

router.post('/scrape', jobController.startScraping);
router.get('/status/:jobId', jobController.getJobStatus);
router.get('/results/:jobId', jobController.getJobResults);

export default router;
