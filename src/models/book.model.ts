export interface BookData {
    title: string;
    author: string;
    currentPrice: number;
    originalPrice?: number; // Optional since not all books are discounted
    description: string;
    productUrl: string;
}

export interface EnrichedBookData extends BookData {
    summary: string;
    relevanceScore: number;
    discountAmount?: number;
    discountPercentage?: number;
    valueScore: number;
}