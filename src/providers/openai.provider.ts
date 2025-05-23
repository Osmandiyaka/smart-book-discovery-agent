import { Configuration, OpenAIApi } from 'openai';
import { AIProvider, CompletionRequest, CompletionResponse, AIProviderConfig } from './ai-provider.interface';
import { Logger } from '../utils/logger';

export class OpenAIProvider implements AIProvider {
    private openai: OpenAIApi;
    private model: string;

    constructor(config: AIProviderConfig) {
        const openaiConfig = new Configuration({ apiKey: config.apiKey });
        this.openai = new OpenAIApi(openaiConfig);
        this.model = config.model;
    }

    async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            const response = await this.openai.createCompletion({
                model: this.model,
                prompt: request.prompt,
                max_tokens: request.maxTokens || 100,
                temperature: request.temperature || 0.5,
            });

            const text = response.data.choices[0].text?.trim() || '';
            Logger.debug('OpenAI completion generated', {
                promptLength: request.prompt.length,
                responseLength: text.length
            });

            return { text };
        } catch (error) {
            Logger.error('OpenAI completion failed', { error: (error as Error).message });
            throw new Error(`OpenAI completion failed: ${(error as Error).message}`);
        }
    }
}
