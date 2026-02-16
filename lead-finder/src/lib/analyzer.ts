import type { ReviewData, AppDetails } from './types';

export interface AnalysisResult {
  no_reply_rate: number;
  no_reply_rate_neg: number;
  unanswered_neg_30d: number;
  sample_size: number;
}

// Analyze reviews to calculate reply metrics
export function analyzeReviews(
  reviews: ReviewData[],
  windowDays: number,
  minAgeDays: number
): AnalysisResult {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const minAgeDate = new Date(now.getTime() - minAgeDays * 24 * 60 * 60 * 1000);

  // Filter reviews within window and older than minAge
  const relevantReviews = reviews.filter(
    r => r.date >= windowStart && r.date <= minAgeDate
  );

  if (relevantReviews.length === 0) {
    return {
      no_reply_rate: 0,
      no_reply_rate_neg: 0,
      unanswered_neg_30d: 0,
      sample_size: 0,
    };
  }

  // Calculate overall no_reply_rate
  const unanswered = relevantReviews.filter(r => !r.replyDate).length;
  const no_reply_rate = (unanswered / relevantReviews.length) * 100;

  // Calculate no_reply_rate for negative reviews (1-2 stars)
  const negativeReviews = relevantReviews.filter(r => r.score <= 2);
  const unansweredNegative = negativeReviews.filter(r => !r.replyDate).length;
  const no_reply_rate_neg =
    negativeReviews.length > 0
      ? (unansweredNegative / negativeReviews.length) * 100
      : 0;

  // Count unanswered negative reviews in last 30 days
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const unanswered_neg_30d = relevantReviews.filter(
    r => r.score <= 2 && !r.replyDate && r.date >= thirtyDaysAgo
  ).length;

  return {
    no_reply_rate: Math.round(no_reply_rate * 10) / 10,
    no_reply_rate_neg: Math.round(no_reply_rate_neg * 10) / 10,
    unanswered_neg_30d,
    sample_size: relevantReviews.length,
  };
}

// Calculate lead score (0-100, higher = better lead)
export function calculateLeadScore(
  analysis: AnalysisResult,
  appDetails: AppDetails
): number {
  let score = 0;

  // 30pts: high no_reply_rate (overall)
  score += Math.min(30, (analysis.no_reply_rate / 100) * 30);

  // 30pts: high no_reply_rate_neg (1-2 stars)
  score += Math.min(30, (analysis.no_reply_rate_neg / 100) * 30);

  // 20pts: recent unanswered negatives (last 30d, capped at 10)
  score += Math.min(20, (analysis.unanswered_neg_30d / 10) * 20);

  // 10pts: app size (log scale, bigger = better lead)
  const reviewsLog = Math.log10(Math.max(1, appDetails.reviews));
  score += Math.min(10, (reviewsLog / 6) * 10); // log10(1M) = 6

  // 10pts: low store rating (more room for improvement)
  const ratingScore = 5 - appDetails.score; // Lower rating = higher score
  score += Math.min(10, (ratingScore / 5) * 10);

  return Math.round(score);
}
