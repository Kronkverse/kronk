import type { ReactNode } from 'react';

// Tiny markdown → React renderer for Kronikles. Deliberately small
// (no dependency) — supports the subset of markdown that maps to
// long-form prose:
//   * headings   `# `, `## `, `### ` at start of line
//   * blockquotes `> ` at start of line (joined into one <blockquote>)
//   * unordered lists `- ` or `* ` at start of line
//   * bold `**x**`, italic `*x*` or `_x_`, inline code `` `x` ``
//   * links `[text](url)` — http(s) only, otherwise rendered as text
//   * paragraphs separated by blank lines; hard line breaks inside a
//     paragraph become `<br/>`.
//
// Anything else (tables, code fences, images, HTML) renders as plain
// text — this keeps the surface small until real long-form authors ask
// for more. All input is treated as untrusted: we build React nodes
// directly (no dangerouslySetInnerHTML), so HTML tags in the body
// render as literal characters.

interface BlockToken {
  type: 'heading' | 'paragraph' | 'list' | 'blockquote';
  level?: number;
  lines: string[];
}

const HTTP_URL = /^https?:\/\//i;

const tokenize = (src: string): BlockToken[] => {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockToken[] = [];
  let buffer: string[] = [];
  let mode: BlockToken['type'] = 'paragraph';

  const flush = () => {
    if (buffer.length === 0) return;
    blocks.push({ type: mode, lines: buffer });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (line.trim() === '') {
      flush();
      mode = 'paragraph';
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        level: heading[1]?.length ?? 1,
        lines: [heading[2] ?? ''],
      });
      mode = 'paragraph';
      continue;
    }

    if (/^>\s?/.test(line)) {
      if (mode !== 'blockquote') flush();
      mode = 'blockquote';
      buffer.push(line.replace(/^>\s?/, ''));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (mode !== 'list') flush();
      mode = 'list';
      buffer.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }

    if (mode !== 'paragraph') {
      flush();
      mode = 'paragraph';
    }
    buffer.push(line);
  }
  flush();
  return blocks;
};

// Inline parser — walks a string, splitting off bold / italic / code /
// links, and emits React nodes. Priority: code > link > bold > italic.
const renderInline = (source: string, keyPrefix: string): ReactNode[] => {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const push = (node: ReactNode) => {
    out.push(node);
  };
  while (i < source.length) {
    const rest = source.slice(i);

    const code = /^`([^`]+)`/.exec(rest);
    if (code) {
      push(<code key={`${keyPrefix}-c-${key++}`}>{code[1]}</code>);
      i += code[0].length;
      continue;
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (link) {
      const [, text, href] = link;
      if (href && HTTP_URL.test(href)) {
        push(
          <a
            key={`${keyPrefix}-l-${key++}`}
            href={href}
            target='_blank'
            rel='noopener noreferrer'
          >
            {text}
          </a>,
        );
      } else {
        push(link[0]); // untrusted scheme — render literally
      }
      i += link[0].length;
      continue;
    }

    const bold = /^\*\*([^*]+)\*\*/.exec(rest);
    if (bold) {
      push(
        <strong key={`${keyPrefix}-b-${key++}`}>
          {renderInline(bold[1] ?? '', `${keyPrefix}-b-${key}`)}
        </strong>,
      );
      i += bold[0].length;
      continue;
    }

    const italic = /^(?:\*([^*]+)\*|_([^_]+)_)/.exec(rest);
    if (italic) {
      const inner = italic[1] ?? italic[2] ?? '';
      push(
        <em key={`${keyPrefix}-i-${key++}`}>
          {renderInline(inner, `${keyPrefix}-i-${key}`)}
        </em>,
      );
      i += italic[0].length;
      continue;
    }

    // Nothing matched — take one char and continue. Merge consecutive
    // text into a single string by peeking at the last node.
    const ch = source.charAt(i);
    const last = out[out.length - 1];
    if (typeof last === 'string') {
      out[out.length - 1] = last + ch;
    } else {
      push(ch);
    }
    i += 1;
  }
  return out;
};

const renderParagraph = (lines: string[], key: string): ReactNode => {
  // Hard line breaks inside a paragraph → <br/>.
  const nodes: ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) nodes.push(<br key={`${key}-br-${idx}`} />);
    nodes.push(...renderInline(line, `${key}-${idx}`));
  });
  return <p key={key}>{nodes}</p>;
};

export const RenderMarkdown: React.FC<{ source: string }> = ({ source }) => {
  const blocks = tokenize(source);
  return (
    <div className='kronikles-markdown'>
      {blocks.map((block, idx) => {
        const key = `b-${idx}`;
        switch (block.type) {
          case 'heading': {
            const level = block.level ?? 1;
            const inner = renderInline(block.lines[0] ?? '', key);
            if (level === 1) return <h1 key={key}>{inner}</h1>;
            if (level === 2) return <h2 key={key}>{inner}</h2>;
            return <h3 key={key}>{inner}</h3>;
          }
          case 'list':
            return (
              <ul key={key}>
                {block.lines.map((line, li) => (
                  <li key={`${key}-${li}`}>
                    {renderInline(line, `${key}-${li}`)}
                  </li>
                ))}
              </ul>
            );
          case 'blockquote':
            return (
              <blockquote key={key}>
                {renderParagraph(block.lines, key)}
              </blockquote>
            );
          case 'paragraph':
          default:
            return renderParagraph(block.lines, key);
        }
      })}
    </div>
  );
};
