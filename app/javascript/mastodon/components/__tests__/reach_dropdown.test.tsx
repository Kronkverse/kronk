import { fireEvent, render, screen } from '@/testing/rendering';

import { ReachDropdown } from '../reach_dropdown';

const noop = () => undefined;

describe('ReachDropdown', () => {
  it('says the narrowest rung as Me by default', () => {
    render(<ReachDropdown value='self_only' onChange={noop} />);

    expect(screen.getByRole('button').textContent).toContain('Me');
  });

  it('says it another way on a Mate’s profile', () => {
    render(
      <ReachDropdown
        value='self_only'
        onChange={noop}
        selfRung={{
          label: 'Only on Ana’s profile',
          hint: 'Not in anyone’s feed',
        }}
      />,
    );

    expect(screen.getByRole('button').textContent).toContain(
      'Only on Ana’s profile',
    );

    fireEvent.click(screen.getByRole('button'));

    const options = screen.getAllByRole('option');
    expect(options[0]?.textContent).toContain(
      'Only on Ana’s profileNot in anyone’s feed',
    );
    expect(options[1]?.textContent).toContain('Mates');
  });
});
