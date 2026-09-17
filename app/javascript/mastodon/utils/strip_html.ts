// Plain text out of a status' HTML body, for excerpts and pickers.
//
// Uses DOMParser rather than a `.replace(/<[^>]*>/g, '')` regex, which was
// wrong on ordinary content: `<[^>]*>` eats from the first `<` to the next
// `>`, so "a < b and c > d" lost its middle, an unclosed `<` swallowed the
// rest of the post, and entities came out raw (`caf&eacute;`).
//
// DOMParser builds an inert document — no scripts run, no resources load,
// nothing touches the live DOM — and gives back properly decoded text.
//
// This is NOT a sanitiser and is not used as one: every caller renders the
// result as React text, which escapes. `<<b>script>` still comes out as the
// literal characters `<script>`, exactly as the regex left it; the
// difference is that here it is unambiguously text.
const NON_TEXT = 'script, style, noscript, template';

export const stripHtml = (html: string): string => {
  if (!html) return '';

  const parsed = new DOMParser().parseFromString(html, 'text/html');

  // textContent includes the *contents* of script and style elements, so an
  // excerpt of a post carrying either would read as source code. Drop them
  // before reading the text.
  parsed.body.querySelectorAll(NON_TEXT).forEach((node) => {
    node.remove();
  });

  return parsed.body.textContent;
};

// As above, then collapse runs of whitespace — block markup becomes a
// single line rather than a column of newlines.
export const stripHtmlToLine = (html: string): string =>
  stripHtml(html).replace(/\s+/g, ' ').trim();
