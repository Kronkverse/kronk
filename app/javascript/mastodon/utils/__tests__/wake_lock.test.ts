import { holdScreenAwake } from '../wake_lock';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('holdScreenAwake', () => {
  let release: ReturnType<typeof vi.fn>;
  let request: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    release = vi.fn(() => Promise.resolve());
    request = vi.fn(() => Promise.resolve({ release }));
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('keeps the screen on until the hold ends', async () => {
    const done = holdScreenAwake();
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
    expect(release).not.toHaveBeenCalled();

    done();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('shares one lock between overlapping holds', async () => {
    const first = holdScreenAwake();
    const second = holdScreenAwake();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    first();
    expect(release).not.toHaveBeenCalled();
    second();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('ignores a second release', async () => {
    const done = holdScreenAwake();
    await flush();
    done();
    done();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the Wake Lock API', () => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => {
      holdScreenAwake()();
    }).not.toThrow();
  });
});
