// Reading a post's HTML for the search results list.

// A post's HTML as the text a reader sees. Parsed rather than stripped with
// a pattern, so `&quot;` comes out as a quote mark and "@" stays joined to
// the name it belongs to. `withoutMentions` drops the @mentions, for telling
// whether a post matched on anything else.
export const plainText = (html: string, withoutMentions = false): string => {
  const doc = new DOMParser().parseFromString(
    html.replace(/<br\s*\/?>|<\/p>/gi, '$& '),
    'text/html',
  );
  if (withoutMentions) {
    doc.querySelectorAll('.mention').forEach((el) => {
      el.remove();
    });
  }
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
};

export const wordsOf = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[@#]/, ''))
    .filter(Boolean);

// Whether a post matched only through an @mention: it mentions someone, and
// none of the search words appear anywhere else in it.
export const matchedOnMentionOnly = (
  status: { content?: string; spoiler_text?: string },
  words: string[],
) => {
  const html = `${status.spoiler_text ?? ''} ${status.content ?? ''}`;
  if (words.length === 0 || !html.includes('mention')) return false;
  const rest = plainText(html, true).toLowerCase();
  if (words.some((word) => rest.includes(word))) return false;
  const full = plainText(html).toLowerCase();
  return words.some((word) => full.includes(word));
};
