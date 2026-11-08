import { render, screen } from '@/testing/rendering';

import { LinkifiedText } from '../linkified_text';

describe('<LinkifiedText>', () => {
  it('makes an outside URL a link that opens in a new tab', () => {
    render(
      <LinkifiedText text='Plans at https://example.org/plan, see you.' />,
    );

    const link = screen.getByRole('link', { name: 'https://example.org/plan' });
    expect(link.getAttribute('href')).toBe('https://example.org/plan');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText(/see you\./)).toBeTruthy();
  });

  it('opens a link to this instance in place', () => {
    const url = `${window.location.origin}/hub/krew/7`;
    render(<LinkifiedText text={`Join ${url}`} />);

    const link = screen.getByRole('link', { name: url });
    expect(link.getAttribute('href')).toBe('/hub/krew/7');
    expect(link.hasAttribute('target')).toBe(false);
  });

  it('leaves text without URLs alone', () => {
    render(<LinkifiedText text='Nothing to see' />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Nothing to see')).toBeTruthy();
  });
});
