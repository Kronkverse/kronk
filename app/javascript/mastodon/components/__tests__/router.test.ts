import { browserHistory } from '../router';

// A composer opened from a Krew carries the way back on to what it makes
// (Tal's proposal "Konnected sources", 2026-11-18).
describe('browserHistory.push from a Konnect composer', () => {
  const fromKrew = { backTo: '/hub/krew/growers', backLabel: 'Growers' };

  it('carries the way back to the record the composer made', () => {
    browserHistory.push({
      pathname: '/hub/albutts/composer',
      search: '?konnect=krew:7',
      state: fromKrew,
    });
    browserHistory.push('/hub/albutts/12');

    expect(browserHistory.location.state).toMatchObject(fromKrew);
  });

  it('reads the older ?krew= the same way', () => {
    browserHistory.push({
      pathname: '/hub/albutts/composer',
      search: '?krew=7',
      state: fromKrew,
    });
    browserHistory.replace('/hub/albutts/12');

    expect(browserHistory.location.state).toMatchObject(fromKrew);
  });

  it('leaves a page in another korner alone', () => {
    browserHistory.push({
      pathname: '/hub/albutts/composer',
      search: '?konnect=krew:7',
      state: fromKrew,
    });
    browserHistory.push('/hub/kalendar/3');

    expect(browserHistory.location.state?.backTo).toBeUndefined();
  });

  it('carries nothing from a composer not opened from a record', () => {
    browserHistory.push({ pathname: '/hub/albutts/composer', state: fromKrew });
    browserHistory.push('/hub/albutts/12');

    expect(browserHistory.location.state?.backTo).toBeUndefined();
  });
});
