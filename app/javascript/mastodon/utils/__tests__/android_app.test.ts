import { androidAppBuild, inAndroidApp, noteAndroidApp } from '../android_app';

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
});
