import { Configuration } from 'openai';
import { environment } from './environment';

export const openaiConfig = new Configuration({
    apiKey: environment.openaiApiKey,
});