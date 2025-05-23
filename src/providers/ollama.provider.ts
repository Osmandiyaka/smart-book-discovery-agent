import axios from 'axios';
import { AIProvider, CompletionRequest, CompletionResponse, AIProviderConfig } from './ai-provider.interface';
import { Logger } from '../utils/logger';

export class OllamaProvider implements AIProvider {
    private baseUrl: string;
    private model: string;

    constructor(config: AIProviderConfig) {
        this.baseUrl = config.baseUrl || 'http://localhost:11434';
        this.model = config.model;
    }

    async generateCompletion(request: CompletionRequest): Promise<CompletionResponse> {
        try {
            const response = await axios.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: request.prompt,
                stream: false,
                options: {
                    temperature: request.temperature || 0.5,
                    num_predict: request.maxTokens || 100,
                }
            }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const text = response.data.response?.trim() || '';
            Logger.debug('Ollama completion generated', {
                promptLength: request.prompt.length,
                responseLength: text.length
            });

            return { text };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.error || error.message;
                Logger.error('Ollama completion failed', { error: message });
                throw new Error(`Ollama completion failed: ${message}`);
            }
            Logger.error('Ollama completion failed', { error: (error as Error).message });
            throw new Error(`Ollama completion failed: ${(error as Error).message}`);
        }
    }
}
