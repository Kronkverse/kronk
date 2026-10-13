import { render, screen } from '@/testing/rendering';
import type { ApiPinnedKuestionJSON } from 'mastodon/api_types/kuestions';

import { ProfileIdentity } from '../profile_identity';

const pin = (
  question_id: string,
  seed_key: string,
  answer_format: ApiPinnedKuestionJSON['answer_format'],
  body: string,
): ApiPinnedKuestionJSON => ({
  question_id,
  title: seed_key,
  label: seed_key,
  seed_key,
  answer_format,
  body,
  choice_index: null,
  visibility_scope: 'public',
  size: null,
  position: Number(question_id),
});

const pins = [
  pin('1', 'pronouns', 'text', 'she / her'),
  pin('2', 'languages', 'list', 'English, Spanish'),
  pin('3', 'star_sign', 'text', 'Scorpio'),
  pin('4', 'website', 'link', 'talitamoss.info'),
];

describe('ProfileIdentity', () => {
  it('lays answers out by format, facts side by side in pin order', () => {
    const { container } = render(<ProfileIdentity pins={pins} />);

    const facts = container.querySelectorAll(
      '.profile-identity__stats > .profile-identity__fact',
    );
    expect(Array.from(facts, (f) => f.textContent)).toEqual([
      'she / her',
      'Scorpio',
    ]);
    expect(screen.getByText('Spanish')).toBeTruthy();
    expect(
      screen.getByText('talitamoss.info').closest('a')?.getAttribute('href'),
    ).toBe('https://talitamoss.info/');
  });

  it('in Arrange, makes each answer draggable and links stop being links', () => {
    const { container } = render(<ProfileIdentity pins={pins} arrange />);

    // Facts stay direct siblings, so the drawn separator still works.
    expect(
      container.querySelectorAll(
        '.profile-identity__stats > .profile-identity__fact.arrange-item',
      ),
    ).toHaveLength(2);
    expect(container.querySelectorAll('.arrange-item')).toHaveLength(4);
    expect(screen.getByText('talitamoss.info').closest('a')).toBeNull();
  });
});
