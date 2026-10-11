import { matchedOnMentionOnly, plainText, wordsOf } from './text';

const mention = (name: string) =>
  `<span class="h-card"><a href="/@${name}" class="u-url mention">@<span>${name}</span></a></span>`;

describe('plainText', () => {
  it('decodes entities and keeps @ joined to the name', () => {
    expect(
      plainText(
        `<p>${mention('Tahlia')} &quot;What is community?&quot; I&#39;m sure</p><p>next</p>`,
      ),
    ).toBe('@Tahlia "What is community?" I\'m sure next');
  });
});

describe('matchedOnMentionOnly', () => {
  const words = wordsOf('Tahlia');

  it('is true when only the @mention carries the word', () => {
    expect(
      matchedOnMentionOnly(
        { content: `<p>${mention('Tahlia')} proud of you</p>` },
        words,
      ),
    ).toBe(true);
  });

  it('is false when the words also appear in what was said', () => {
    expect(
      matchedOnMentionOnly(
        { content: `<p>${mention('tal')} I saw Tahlia dance</p>` },
        words,
      ),
    ).toBe(false);
  });

  it('is false for a post with no mention', () => {
    expect(
      matchedOnMentionOnly({ content: '<p>Tahlia danced</p>' }, words),
    ).toBe(false);
  });
});
