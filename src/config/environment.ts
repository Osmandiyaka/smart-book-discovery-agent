import dotenv from 'dotenv';

dotenv.config();

export const environment = {
    port: process.env.PORT || 3000,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    makecomWebhookUrl: process.env.MAKECOM_WEBHOOK_URL || '',
    nodeEnv: process.env.NODE_ENV || 'development',
};