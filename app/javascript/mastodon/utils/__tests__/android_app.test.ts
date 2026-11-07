import {
  androidAppBuild,
  inAndroidApp,
  noteAndroidApp,
  offerAndroidApp,
} from '../android_app';

const open = (path: string) => {
  window.history.replaceState(null, '', path);
};

describe('android app', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('is not the app on an ordinary visit', () => {
    open('/home');
    noteAndroidApp();
    expect(inAndroidApp()).toBe(false);
    expect(androidAppBuild()).toBeNull();
  });

  it('recognises the app and its build from the launch URL', () => {
    open('/?source=app&app=20261100');
    noteAndroidApp();
    expect(inAndroidApp()).toBe(true);
    expect(androidAppBuild()).toBe(20261100);
  });

  it('takes the parameters back out of the address', () => {
    open('/?source=app&app=20261100&q=keep');
    noteAndroidApp();
    expect(window.location.search).toBe('?q=keep');
  });

  it('stays the app after a reload without the parameters', () => {
    open('/?source=app&app=20261100');
    noteAndroidApp();
    open('/home');
    noteAndroidApp();
    expect(inAndroidApp()).toBe(true);
    expect(androidAppBuild()).toBe(20261100);
  });

  it('ignores a build that is not a number', () => {
    open('/?source=app&app=nope');
    noteAndroidApp();
    expect(inAndroidApp()).toBe(true);
    expect(androidAppBuild()).toBeNull();
  });

  describe('offering the app', () => {
    const agent = (value: string) => {
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value);
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('offers it to an Android browser', () => {
      agent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0');
      open('/home');
      noteAndroidApp();
      expect(offerAndroidApp()).toBe(true);
    });

    it('does not offer it inside the app', () => {
      agent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0');
      open('/?source=app&app=20261100');
      noteAndroidApp();
      expect(offerAndroidApp()).toBe(false);
    });

    it('does not offer it off Android', () => {
      agent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
      open('/home');
      noteAndroidApp();
      expect(offerAndroidApp()).toBe(false);
    });
  });
});
