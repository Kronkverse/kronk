import { act, fireEvent, render, screen } from '@/testing/rendering';

import Awawb from '../index';

// docs/design.md, Pillars: the Acknowledgement of Country comes first each
// time the page opens, then the flag.
describe('Awawb', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('acknowledges Country first, then shows the flag', () => {
    render(<Awawb />);

    expect(
      screen.getByText(/acknowledges the Traditional Owners/),
    ).toBeTruthy();
    expect(screen.queryByText('Always was.')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(
      screen.queryByText(/acknowledges the Traditional Owners/),
    ).toBeNull();
    expect(screen.getByText('Always was.')).toBeTruthy();
  });

  it('goes straight on when the acknowledgement is tapped', () => {
    render(<Awawb />);

    fireEvent.click(screen.getByText(/acknowledges the Traditional Owners/));

    expect(screen.getByText('Always will be.')).toBeTruthy();
  });
});
