import type { MetadataRoute } from 'next';

/**
 * Keep the competition out of search engines entirely.
 *
 * This is a private school event. The link is handed out deliberately — on a
 * projector, on a QR code in the hall — and nobody should arrive at it by
 * searching for the school's name, now or in two years when the results are
 * still sitting in the database.
 *
 * This stops honest crawlers indexing anything. It is not a lock: a crawler
 * that ignores robots.txt, or anyone who has the URL, can still reach the site.
 * Actual access control is the Round 2 PIN, and Vercel's deployment password if
 * you want the whole thing sealed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
