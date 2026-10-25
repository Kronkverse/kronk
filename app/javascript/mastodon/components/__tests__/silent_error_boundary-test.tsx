import { render, screen } from '@/testing/rendering';

import { SilentErrorBoundary } from '../silent_error_boundary';

const Throws: React.FC = () => {
  throw new Error('Failed to initialize WebGL');
};

describe('<SilentErrorBoundary />', () => {
  it('renders nothing in place of a child that throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <div>
        <p>around</p>
        <SilentErrorBoundary>
          <Throws />
        </SilentErrorBoundary>
      </div>,
    );

    expect(screen.getByText('around')).toBeTruthy();
    vi.restoreAllMocks();
  });
});
