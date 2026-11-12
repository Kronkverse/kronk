import { shrinkVideo } from '../compress_video';

const fileOf = (bytes: number, type = 'video/mp4') =>
  new File([new Uint8Array(bytes)], 'clip.mp4', { type });

describe('shrinkVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves a small video alone', async () => {
    vi.stubGlobal('VideoEncoder', vi.fn());
    const file = fileOf(1024);

    await expect(shrinkVideo(file)).resolves.toBe(file);
  });

  it('leaves a big video alone where the browser has no encoder', async () => {
    vi.stubGlobal('VideoEncoder', undefined);
    const file = fileOf(21 * 1024 * 1024);

    await expect(shrinkVideo(file)).resolves.toBe(file);
  });

  it('sends the original when the file is not a video it can read', async () => {
    vi.stubGlobal('VideoEncoder', vi.fn());
    const file = fileOf(21 * 1024 * 1024);

    await expect(shrinkVideo(file)).resolves.toBe(file);
  });
});
