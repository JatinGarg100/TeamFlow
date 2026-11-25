/**
 * securityHeaders.js
 * ──────────────────
 * Sets standard HTTP security response headers equivalent to Helmet:
 * - Prevents MIME-sniffing
 * - Prevents Clickjacking (X-Frame-Options)
 * - Enables XSS filtering
 * - Enforces Strict-Transport-Security (HSTS)
 * - Restricts Referrer-Policy
 * - Hides Express fingerprint
 */
const securityHeaders = (req, res, next) => {
  // Prevent browsers from MIME-sniffing the response
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent Clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Enable Cross-Site Scripting filter in legacy browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Control referrer information sent in HTTP headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict resource embedding and cross-origin leakage
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // Disable DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // Prevent Internet Explorer from executing downloads in site's context
  res.setHeader('X-Download-Options', 'noopen');

  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove Express fingerprint header
  res.removeHeader('X-Powered-By');

  next();
};

module.exports = securityHeaders;
