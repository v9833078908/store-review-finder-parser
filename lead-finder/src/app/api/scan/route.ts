import { NextRequest } from 'next/server';
import { fetchTopApps, fetchAppDetails, fetchReviews } from '@/lib/scraper';
import { analyzeReviews, calculateLeadScore } from '@/lib/analyzer';
import { SUPPORTED_COUNTRIES } from '@/lib/constants';
import type { ScanParams, ScanEvent, AppResult } from '@/lib/types';

export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse scan parameters
  const categoryParam = searchParams.get('category');
  const countryParam = searchParams.get('country') || 'us';
  const langParam = searchParams.get('lang') || 'en';

  // Validate country (fallback to 'us' if not supported)
  const country = SUPPORTED_COUNTRIES.includes(
    countryParam as (typeof SUPPORTED_COUNTRIES)[number]
  )
    ? countryParam
    : 'us';
  const lang = country === 'us' ? 'en' : langParam; // Use English for US

  if (country !== countryParam) {
    console.warn(`[API /api/scan] Unsupported country "${countryParam}", using "${country}" instead`);
  }

  const params: ScanParams = {
    collection: searchParams.get('collection') || 'TOP_FREE',
    category: categoryParam && categoryParam !== 'undefined' ? categoryParam : undefined,
    country,
    lang,
    maxApps: parseInt(searchParams.get('maxApps') || '50', 10),
    maxReviews: parseInt(searchParams.get('maxReviews') || '200', 10),
    windowDays: parseInt(searchParams.get('windowDays') || '365', 10),
    minAgeDays: parseInt(searchParams.get('minAgeDays') || '0', 10),
  };

  console.log('[API /api/scan] Received params:', JSON.stringify(params, null, 2));

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let totalProcessed = 0;
      let totalErrors = 0;

      const sendEvent = (event: ScanEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      try {
        // Fetch top apps
        const appIds = await fetchTopApps(
          params.collection,
          params.category,
          params.country,
          params.lang,
          params.maxApps
        );

        // Process each app sequentially
        for (let i = 0; i < appIds.length; i++) {
          const appId = appIds[i];

          try {
            // Fetch app details
            const appDetails = await fetchAppDetails(
              appId,
              params.lang,
              params.country
            );

            // Send progress
            sendEvent({
              type: 'progress',
              current: i + 1,
              total: appIds.length,
              appId: appDetails.appId,
              title: appDetails.title,
            });

            // Fetch reviews
            const reviews = await fetchReviews(
              appId,
              params.lang,
              params.country,
              params.maxReviews
            );

            // Analyze reviews
            const analysis = analyzeReviews(
              reviews,
              params.windowDays,
              params.minAgeDays
            );

            // Calculate lead score
            const leadScore = calculateLeadScore(analysis, appDetails);

            // Create result
            const result: AppResult = {
              developer: appDetails.developer,
              title: appDetails.title,
              url: appDetails.url,
              no_reply_rate: analysis.no_reply_rate,
              no_reply_rate_neg: analysis.no_reply_rate_neg,
              unanswered_neg_30d: analysis.unanswered_neg_30d,
              lead_score: leadScore,
              appId: appDetails.appId,
              developerEmail: appDetails.developerEmail,
              score: appDetails.score,
              total_reviews_count: appDetails.reviews,
              sample_size: analysis.sample_size,
            };

            // Send result
            sendEvent({ type: 'result', data: result });
            totalProcessed++;

            // Rate limiting: 1s delay between apps
            if (i < appIds.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            // Per-app error isolation
            const message = error instanceof Error ? error.message : 'Unknown error';
            sendEvent({
              type: 'error',
              message: `Error processing ${appId}: ${message}`,
              appId,
            });
            totalErrors++;
          }
        }

        // Send done event
        sendEvent({ type: 'done', totalProcessed, totalErrors });
      } catch (error) {
        // Fatal error
        const message = error instanceof Error ? error.message : 'Unknown error';
        sendEvent({ type: 'error', message: `Fatal error: ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
