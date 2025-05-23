import { AIProviderConfig } from '../providers/ai-provider.interface';

export const aiConfig: AIProviderConfig = {
    provider: process.env.AI_PROVIDER as 'openai' | 'ollama' || 'ollama',
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.AI_BASE_URL || (process.env.AI_PROVIDER === 'ollama' ? 'http://localhost:11434' : undefined),
    model: process.env.AI_MODEL || (process.env.AI_PROVIDER === 'ollama' ? 'llama2' : 'gpt-3.5-turbo-instruct'),
};