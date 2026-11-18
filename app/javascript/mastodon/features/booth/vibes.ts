import { defineMessages } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import EcoIcon from '@/material-icons/400-24px/eco.svg?react';
import GraphicEqIcon from '@/material-icons/400-24px/graphic_eq.svg?react';
import HistoryEduIcon from '@/material-icons/400-24px/history_edu.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note.svg?react';

import type { BoothVibe } from './types';

// How a set feels (`BoothSet::VIBES`, docs/spaces/booth.md, Vibes): a
// fixed few beside the free genres, for listening by what you're after
// (Tal's Kommons proposal "Booth Revamp"). A set has up to two.

export const VIBES: readonly BoothVibe[] = [
  'acoustic',
  'beats',
  'poetry',
  'organic',
];

export const VIBES_MAX = 2;

export const isVibe = (value: string | null | undefined): value is BoothVibe =>
  VIBES.includes(value as BoothVibe);

const names = defineMessages({
  acoustic: { id: 'booth.vibe.acoustic', defaultMessage: 'Acoustic' },
  beats: { id: 'booth.vibe.beats', defaultMessage: 'Beats' },
  poetry: { id: 'booth.vibe.poetry', defaultMessage: 'Poetry' },
  organic: { id: 'booth.vibe.organic', defaultMessage: 'Organic' },
});

const hints = defineMessages({
  acoustic: {
    id: 'booth.vibe.acoustic_hint',
    defaultMessage: 'Voices and instruments, unplugged',
  },
  beats: {
    id: 'booth.vibe.beats_hint',
    defaultMessage: 'Made to move to',
  },
  poetry: {
    id: 'booth.vibe.poetry_hint',
    defaultMessage: 'Words first: spoken, sung or read',
  },
  organic: {
    id: 'booth.vibe.organic_hint',
    defaultMessage: 'Minimal electronics',
  },
});

export const vibeName = (vibe: BoothVibe): MessageDescriptor => names[vibe];
export const vibeHint = (vibe: BoothVibe): MessageDescriptor => hints[vibe];

export const VIBE_ICONS: Record<
  BoothVibe,
  React.FC<React.SVGProps<SVGSVGElement>>
> = {
  acoustic: MusicNoteIcon,
  beats: GraphicEqIcon,
  poetry: HistoryEduIcon,
  organic: EcoIcon,
};
