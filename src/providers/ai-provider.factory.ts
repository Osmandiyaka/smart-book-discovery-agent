import { AIProvider, AIProviderConfig } from './ai-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { OllamaProvider } from './ollama.provider';

export class AIProviderFactory {
    static create(config: AIProviderConfig): AIProvider {
        switch (config.provider) {
            case 'openai':
                return new OpenAIProvider(config);
            case 'ollama':
                return new OllamaProvider(config);
            default:
                throw new Error(`Unsupported AI provider: ${config.provider}`);
        }
    }
}