import app from './app';
import { environment } from './config/environment';
import { Logger } from './utils/logger';

const port = environment.port;

app.listen(port, () => {
    Logger.info(`Server is running on port ${port}`);
});