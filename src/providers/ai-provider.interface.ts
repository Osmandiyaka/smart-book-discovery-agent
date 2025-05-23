export interface AIProviderConfig {
    provider: 'openai' | 'ollama';
    apiKey?: string;
    baseUrl?: string;
    model: string;
}

export interface CompletionRequest {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
}

export interface CompletionResponse {
    text: string;
}

export interface AIProvider {
    generateCompletion(request: CompletionRequest): Promise<CompletionResponse>;
}