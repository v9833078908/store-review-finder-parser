import gplay from 'google-play-scraper';
import type { AppDetails, ReviewData } from './types';

type ListOptions = Parameters<typeof gplay.list>[0];
type ReviewsOptions = Parameters<typeof gplay.reviews>[0];

interface ListResultItem {
  appId?: string;
}

interface ReviewBatchItem {
  id?: string;
  date?: Date | string;
  score?: number;
  text?: string;
  replyDate?: Date | string | null;
  replyText?: string | null;
}

interface ReviewsBatch {
  data: ReviewBatchItem[];
  nextPaginationToken?: string | null;
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Fetch top apps list
export async function fetchTopApps(
  collection: string,
  category: string | undefined,
  country: string,
  lang: string,
  num: number
): Promise<string[]> {
  return withRetry(async () => {
    const options: ListOptions = {
      collection: collection as ListOptions["collection"],
      country,
      lang,
      num,
      fullDetail: false,
    };

    if (category) {
      options.category = category as ListOptions["category"];
    }

    console.log('[fetchTopApps] Options:', JSON.stringify(options, null, 2));

    try {
      const results = (await gplay.list(options)) as ListResultItem[];
      console.log(`[fetchTopApps] Found ${results.length} apps`);
      return results
        .map((app) => String(app.appId || '').trim())
        .filter((appId) => appId.length > 0);
    } catch (error) {
      console.error('[fetchTopApps] Error:', error);
      throw error;
    }
  });
}

// Fetch app details
export async function fetchAppDetails(
  appId: string,
  lang: string,
  country: string
): Promise<AppDetails> {
  return withRetry(async () => {
    const app = await gplay.app({
      appId,
      lang,
      country,
    });

    return {
      appId: app.appId,
      title: app.title,
      developer: app.developer,
      developerEmail: app.developerEmail || null,
      score: app.score || 0,
      reviews: app.reviews || 0,
      url: app.url,
    };
  });
}

// Fetch reviews (without userName/userImage)
export async function fetchReviews(
  appId: string,
  lang: string,
  country: string,
  maxReviews: number
): Promise<ReviewData[]> {
  const reviews: ReviewData[] = [];
  let nextPaginationToken: string | null = null;

  while (reviews.length < maxReviews) {
    const batch = await withRetry(async () => {
      const options: ReviewsOptions = {
        appId,
        lang,
        country,
        sort: 1 as ReviewsOptions["sort"], // NEWEST
        num: Math.min(150, maxReviews - reviews.length),
      };

      if (nextPaginationToken) {
        options.nextPaginationToken = nextPaginationToken;
      }

      return (await gplay.reviews(options)) as ReviewsBatch;
    });

    // Extract only needed fields (no userName, no userImage)
    const mappedReviews: ReviewData[] = batch.data.map((review, index) => ({
      id: String(review.id || `${appId}-${reviews.length + index + 1}`),
      date: review.date ? new Date(review.date) : new Date(),
      score: Number(review.score || 0),
      text: review.text || '',
      replyDate: review.replyDate ? new Date(review.replyDate) : null,
      replyText: review.replyText || null,
    }));

    reviews.push(...mappedReviews);

    // Check if we have more pages
    if (!batch.nextPaginationToken || reviews.length >= maxReviews) {
      break;
    }

    nextPaginationToken = batch.nextPaginationToken;

    // Rate limiting between pages
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return reviews.slice(0, maxReviews);
}
