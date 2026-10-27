import { crowdMessage, crowdMessageText, trackMessageText } from './crowd';
import type { BoothLiveMoment } from './types';

// The message the host's page sends into the call. docs/spaces/booth.md
// documents this shape for the Jitsi server's overlay script, so a change
// here is a change there.

const moment = (patch: Partial<BoothLiveMoment>): BoothLiveMoment => ({
  id: '1',
  kind: 'shoutout',
  body: 'This tune!',
  artist: null,
  title: null,
  text: 'This tune!',
  at_seconds: 754,
  created_at: '2026-10-27T20:00:00Z',
  account: {
    id: '7',
    acct: 'rosa',
    username: 'rosa',
    display_name: 'Rosa',
    avatar: 'https://example.org/a.png',
  },
  can_remove: false,
  ...patch,
});

describe('crowdMessage', () => {
  it('is version 1, with the type, the name, the words and the time', () => {
    expect(crowdMessage(moment({}))).toEqual({
      kronk: 1,
      type: 'shoutout',
      name: 'Rosa',
      text: 'This tune!',
      at: 754,
    });
  });

  it('carries a reaction’s key and a track as it reads', () => {
    expect(
      crowdMessage(moment({ kind: 'reaction', body: 'rewind', text: 'rewind' }))
        .text,
    ).toBe('rewind');
    expect(
      crowdMessage(
        moment({
          kind: 'track',
          body: '',
          artist: 'Burial',
          title: 'Archangel',
          text: 'Burial – Archangel',
        }),
      ),
    ).toMatchObject({ type: 'track', text: 'Burial – Archangel' });
  });

  it('goes into the call as JSON with exactly those keys', () => {
    expect(
      Object.keys(JSON.parse(crowdMessageText(moment({}))) as object),
    ).toEqual(['kronk', 'type', 'name', 'text', 'at']);
    expect(JSON.parse(trackMessageText('Rosa', 'Archangel', 60))).toEqual({
      kronk: 1,
      type: 'track',
      name: 'Rosa',
      text: 'Archangel',
      at: 60,
    });
  });
});
