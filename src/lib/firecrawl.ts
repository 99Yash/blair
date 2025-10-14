import Firecrawl from '@mendable/firecrawl-js';

export const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export interface ScrapedContent {
  url: string;
  markdown?: string;
  html?: string;
  title?: string;
  description?: string;
  language?: string;
  sourceURL?: string;
  statusCode?: number;
}

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  try {
    const { markdown, metadata } = await firecrawl.scrape(url, {
      formats: ['markdown'],
      onlyMainContent: true,
    });

    if (markdown && metadata) {
      return {
        url,
        markdown,
        title: metadata.title,
        description: metadata.description,
        language: metadata.language,
        sourceURL: metadata.sourceURL,
        statusCode: metadata.statusCode,
      };
    } else {
      throw new Error('Failed to scrape URL');
    }
  } catch (error) {
    console.error('Error scraping URL:', error);
    throw new Error(`Failed to scrape content from ${url}`);
  }
}
