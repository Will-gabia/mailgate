import { logger } from "../config/logger.js";

// Common English stopwords to filter out
const STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take",
  "people", "into", "year", "your", "good", "some", "could", "them", "see",
  "other", "than", "then", "now", "look", "only", "come", "its", "over",
  "think", "also", "back", "after", "use", "two", "how", "our", "work",
  "first", "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "are", "has", "was", "been", "is", "am",
  "were", "did", "does", "had", "should", "may", "might", "shall",
  "re", "ve", "ll", "don", "doesn", "didn", "won", "isn", "aren", "wasn",
]);

const MIN_WORD_LENGTH = 3;
const MAX_KEYWORDS = 10;

/**
 * Strip HTML tags from a string to extract plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gis, "")
    .replace(/<script[^>]*>.*?<\/script>/gis, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract top keywords from email body text.
 * Uses simple TF (term frequency) approach:
 *  1. Normalize and split into words
 *  2. Filter stopwords and short words
 *  3. Count frequencies
 *  4. Return top N keywords
 */
export function extractKeywords(
  textBody?: string,
  htmlBody?: string,
  maxKeywords: number = MAX_KEYWORDS
): string[] {
  let text = textBody || "";
  if (!text && htmlBody) {
    text = stripHtml(htmlBody);
  }

  if (!text) return [];

  // Normalize: lowercase, split by non-word characters (supports basic Unicode)
  const words = text
    .toLowerCase()
    .split(/[^a-z가-힣ㄱ-ㅎㅏ-ㅣ0-9]+/i)
    .filter(
      (w) =>
        w.length >= MIN_WORD_LENGTH &&
        !STOPWORDS.has(w) &&
        !/^\d+$/.test(w) // exclude pure numbers
    );

  if (words.length === 0) return [];

  // Count frequencies
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency desc, take top N
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  logger.debug({ keywordCount: sorted.length }, "Keywords extracted from email body");

  return sorted;
}