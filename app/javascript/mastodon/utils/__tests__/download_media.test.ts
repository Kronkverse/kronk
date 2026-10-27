import { downloadMedia, handleMediaDownloadClick } from '../download_media';

const opts = {
  url: 'https://media.example/media_attachments/files/1/original/abc.JPG',
  fallbackUrl: '/media/42/download',
  id: '42',
};

let clicked: { href: string; download: string }[];

const setPointer = (coarse: boolean) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
  }));
};

const setShare = (
  share: ((data: ShareData) => Promise<void>) | undefined,
  canShare = true,
) => {
  Object.defineProperty(navigator, 'share', {
    value: share,
    configurable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: share ? () => canShare : undefined,
    configurable: true,
  });
};

beforeEach(() => {
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({
      href: this.getAttribute('href') ?? '',
      download: this.download,
    });
  });
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(new Blob(['x'], { type: 'image/jpeg' }), { status: 200 }),
      ),
    ),
  );
  setPointer(false);
  setShare(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('downloadMedia', () => {
  it('downloads the fetched file under a Kronk name', async () => {
    await downloadMedia(opts);
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'kronk-42.jpg' }]);
  });

  it('falls back to the download route when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('blocked'))),
    );
    await downloadMedia(opts);
    expect(clicked).toEqual([{ href: '/media/42/download', download: '' }]);
  });

  it('falls back when the media host answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 }))),
    );
    await downloadMedia(opts);
    expect(clicked).toEqual([{ href: '/media/42/download', download: '' }]);
  });

  it('opens the share sheet on a phone that can share files', async () => {
    setPointer(true);
    const share = vi.fn(() => Promise.resolve());
    setShare(share);
    await downloadMedia(opts);
    expect(share).toHaveBeenCalledTimes(1);
    expect(clicked).toEqual([]);
  });

  it('does nothing more when the share sheet is closed', async () => {
    setPointer(true);
    setShare(() => Promise.reject(new DOMException('no', 'AbortError')));
    await downloadMedia(opts);
    expect(clicked).toEqual([]);
  });

  it('downloads when sharing fails for another reason', async () => {
    setPointer(true);
    setShare(() => Promise.reject(new DOMException('no', 'NotAllowedError')));
    await downloadMedia(opts);
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'kronk-42.jpg' }]);
  });

  it('downloads rather than shares on a desktop', async () => {
    const share = vi.fn(() => Promise.resolve());
    setShare(share);
    await downloadMedia(opts);
    expect(share).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(1);
  });
});

describe('handleMediaDownloadClick', () => {
  const click = (over: { metaKey?: boolean } = {}) => ({
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    currentTarget: { href: '/media/42/download' },
    preventDefault: vi.fn(),
    ...over,
  });
  const photo = { type: 'image', url: opts.url, id: '42' };

  it('takes over a plain click on a photo', () => {
    const e = click();
    handleMediaDownloadClick(e, photo);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('leaves a video, or a modified click, to the link', () => {
    const video = click();
    handleMediaDownloadClick(video, { ...photo, type: 'video' });
    expect(video.preventDefault).not.toHaveBeenCalled();

    const newTab = click({ metaKey: true });
    handleMediaDownloadClick(newTab, photo);
    expect(newTab.preventDefault).not.toHaveBeenCalled();
  });
});
