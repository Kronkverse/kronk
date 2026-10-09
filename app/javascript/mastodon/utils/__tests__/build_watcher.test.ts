import { decide, holdReload } from '../build_watcher';

const base = {
  serverBuild: 'b2',
  loadedBuild: 'b1',
  reloadedFor: null,
  busy: false,
};

describe('build watcher decide', () => {
  it('does nothing when the build is unchanged', () => {
    expect(decide({ ...base, serverBuild: 'b1' })).toBe('nothing');
  });

  it('does nothing when either build is unknown', () => {
    expect(decide({ ...base, serverBuild: null })).toBe('nothing');
    expect(decide({ ...base, loadedBuild: null })).toBe('nothing');
  });

  it('reloads on a new build when nothing is in progress', () => {
    expect(decide(base)).toBe('reload');
  });

  it('defers while something must not be lost', () => {
    expect(decide({ ...base, busy: true })).toBe('defer');
  });

  it('never reloads twice for the same build', () => {
    expect(decide({ ...base, reloadedFor: 'b2' })).toBe('nothing');
  });

  it('still reloads for a newer build after an earlier reload', () => {
    expect(decide({ ...base, serverBuild: 'b3', reloadedFor: 'b2' })).toBe(
      'reload',
    );
  });
});

describe('holdReload', () => {
  it('releases once, however often it is called', () => {
    const release = holdReload();
    release();
    release();
    expect(holdReload).toBeInstanceOf(Function);
  });
});
