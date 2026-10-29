import { render, screen } from '@/testing/rendering';

// MapLibre's constructor throws like it does on a device whose WebGL
// context can't be created.
const MockMap = vi.fn(() => {
  throw new Error('Failed to initialize WebGL');
});
vi.mock('maplibre-gl', () => ({ Map: MockMap, addProtocol: vi.fn() }));

const loadPreview = async () =>
  (await import('../map_pin_preview')).MapPinPreview;

describe('<MapPinPreview /> without WebGL', () => {
  beforeEach(() => {
    vi.resetModules();
    MockMap.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the place name instead of a map when WebGL is off', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const MapPinPreview = await loadPreview();

    render(<MapPinPreview lat={-33.86} lng={151.2} label='Bondi Pavilion' />);

    expect(screen.getByText('Bondi Pavilion')).toBeTruthy();
    expect(
      screen.getByText('No map: this browser has WebGL turned off.'),
    ).toBeTruthy();
    expect(MockMap).not.toHaveBeenCalled();
  });

  it('falls back instead of throwing when the map fails to start', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as RenderingContext,
    );
    const MapPinPreview = await loadPreview();

    render(<MapPinPreview lat={-33.86} lng={151.2} />);

    expect(MockMap).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText('No map: this browser has WebGL turned off.'),
    ).toBeTruthy();
  });
});
