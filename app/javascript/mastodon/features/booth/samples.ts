import { defineMessages } from 'react-intl';
import type { IntlShape, MessageDescriptor } from 'react-intl';

import GraphicEqIcon from '@/material-icons/400-24px/graphic_eq.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note.svg?react';
import RepeatIcon from '@/material-icons/400-24px/repeat.svg?react';
import StacksIcon from '@/material-icons/400-24px/stacks.svg?react';

import { formatDuration } from './format';
import type { BoothSample, BoothSampleTerms, BoothSampleType } from './types';

// Samples (docs/spaces/booth.md, Samples): short loops, vocals, beats,
// one-shots and stems shared for others to make things with. Their types,
// terms and how a sample is described on cards and its page.

export const SAMPLE_TYPES: readonly BoothSampleType[] = [
  'loop',
  'vocal',
  'beat',
  'one_shot',
  'stem',
];

export const SAMPLE_TERMS: readonly BoothSampleTerms[] = ['free', 'ask'];

// `BoothSample::DURATION_MAX`: a sample is something to build with, not a
// track.
export const SAMPLE_SECONDS_MAX = 120;

export const isSampleType = (
  value: string | null | undefined,
): value is BoothSampleType => SAMPLE_TYPES.includes(value as BoothSampleType);

const typeNames = defineMessages({
  loop: { id: 'booth.sample.type.loop', defaultMessage: 'Loop' },
  vocal: { id: 'booth.sample.type.vocal', defaultMessage: 'Vocal' },
  beat: { id: 'booth.sample.type.beat', defaultMessage: 'Beat' },
  one_shot: { id: 'booth.sample.type.one_shot', defaultMessage: 'One-shot' },
  stem: { id: 'booth.sample.type.stem', defaultMessage: 'Stem' },
});

const termNames = defineMessages({
  free: { id: 'booth.sample.terms.free', defaultMessage: 'Free with credit' },
  ask: { id: 'booth.sample.terms.ask', defaultMessage: 'Ask first' },
});

const termHints = defineMessages({
  free: {
    id: 'booth.sample.terms.free_hint',
    defaultMessage:
      'Anyone in the Booth can download it and use it, as long as they credit you under Samples used.',
  },
  ask: {
    id: 'booth.sample.terms.ask_hint',
    defaultMessage:
      'Anyone can listen. To download it and use it, they ask you, and you say yes or no.',
  },
});

const metaMessages = defineMessages({
  bpm: { id: 'booth.sample.bpm', defaultMessage: '{bpm} BPM' },
});

export const sampleTypeName = (type: BoothSampleType): MessageDescriptor =>
  typeNames[type];
export const sampleTermsName = (terms: BoothSampleTerms): MessageDescriptor =>
  termNames[terms];
export const sampleTermsHint = (terms: BoothSampleTerms): MessageDescriptor =>
  termHints[terms];

export const SAMPLE_ICONS: Record<
  BoothSampleType,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  loop: RepeatIcon,
  vocal: MicIcon,
  beat: GraphicEqIcon,
  one_shot: MusicNoteIcon,
  stem: StacksIcon,
};

// "Loop · 92 BPM · A minor · 0:08": what a card and the page say about it.
export const sampleFacts = (sample: BoothSample, intl: IntlShape): string[] =>
  [
    intl.formatMessage(sampleTypeName(sample.sample_type)),
    sample.bpm ? intl.formatMessage(metaMessages.bpm, { bpm: sample.bpm }) : '',
    sample.musical_key ?? '',
    formatDuration(sample.duration_seconds),
  ].filter(Boolean);

// Saving the file goes through the web route, so a plain link carries the
// session and the terms are checked (BoothController#download_sample).
export const sampleDownloadUrl = (sample: BoothSample): string =>
  `/hub/booth/samples/${sample.id}/download`;

// Who made it: their display name, or their handle when they have none.
export const makerName = (account: {
  display_name: string;
  acct: string;
}): string => account.display_name || account.acct;
