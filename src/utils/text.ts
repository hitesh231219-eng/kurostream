/**
 * Utility functions for text cleaning and HTML entity decoding
 */

export function cleanHtmlDescription(text: string | null | undefined): string {
  if (!text) return '';

  // First decode common HTML entities
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
  };

  let decoded = text.replace(/&[#\w]+;/g, (match) => {
    if (entities[match]) return entities[match];
    // Numeric entity decimal
    const numDecMatch = match.match(/&#(\d+);/);
    if (numDecMatch) {
      return String.fromCharCode(parseInt(numDecMatch[1], 10));
    }
    // Numeric entity hex
    const numHexMatch = match.match(/&#x([0-9a-fA-F]+);/);
    if (numHexMatch) {
      return String.fromCharCode(parseInt(numHexMatch[1], 16));
    }
    return match;
  });

  // Remove HTML tags
  decoded = decoded.replace(/<br\s*\/?>/gi, '\n');
  decoded = decoded.replace(/<\/p>/gi, '\n\n');
  decoded = decoded.replace(/<[^>]*>/g, '');

  // Normalize excessive whitespace while preserving single paragraph breaks
  decoded = decoded.replace(/\n{3,}/g, '\n\n').trim();

  return decoded;
}

export function formatTimeUntilAiring(seconds: number): string {
  if (seconds <= 0) return 'Airing soon';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
