import ArticleIcon from '@/material-icons/400-24px/article-fill.svg?react';
import MicIcon from '@/material-icons/400-24px/mic.svg?react';
import MusicNoteIcon from '@/material-icons/400-24px/music_note-fill.svg?react';
import PhotoCameraIcon from '@/material-icons/400-24px/photo_camera.svg?react';
import PhotoLibraryIcon from '@/material-icons/400-24px/photo_library-fill.svg?react';
import type { DialBubble, DialSlice } from 'mastodon/components/kronk_dial';

// Shared Art taxonomy — imported by both the browse view
// (features/art/index.tsx) and the composer (features/art/composer.tsx)
// so a new discipline or shelf lands in both surfaces from a single
// edit here.

export interface ArtHouse {
  bubble: DialBubble;
  slices: DialSlice[];
}

export const HOUSES: ArtHouse[] = [
  {
    bubble: { key: 'writing', label: 'Writing', Icon: ArticleIcon },
    slices: [
      { key: 'journals', label: 'Journals' },
      { key: 'chapters', label: 'Chapters' },
      { key: 'poems', label: 'Poems' },
      { key: 'essays', label: 'Essays' },
      { key: 'volumes', label: 'Volumes' },
      { key: 'authors', label: 'Authors' },
      { key: 'letters', label: 'Letters' },
    ],
  },
  {
    bubble: { key: 'photography', label: 'Photography', Icon: PhotoCameraIcon },
    slices: [
      { key: 'rolls', label: 'Rolls' },
      { key: 'frames', label: 'Frames' },
      { key: 'series', label: 'Series' },
      { key: 'photographers', label: 'Photographers' },
      { key: 'prints', label: 'Prints' },
    ],
  },
  {
    bubble: { key: 'music', label: 'Music', Icon: MusicNoteIcon },
    slices: [
      { key: 'tracks', label: 'Tracks' },
      { key: 'albums', label: 'Albums' },
      { key: 'sessions', label: 'Sessions' },
      { key: 'composers', label: 'Composers' },
      { key: 'sets', label: 'Sets' },
    ],
  },
  {
    bubble: { key: 'voice', label: 'Voice', Icon: MicIcon },
    slices: [
      { key: 'readings', label: 'Readings' },
      { key: 'voices', label: 'Voices' },
      { key: 'threads', label: 'Threads' },
      { key: 'talks', label: 'Talks' },
    ],
  },
  {
    bubble: { key: 'gallery', label: 'Gallery', Icon: PhotoLibraryIcon },
    slices: [
      { key: 'pieces', label: 'Pieces' },
      { key: 'series', label: 'Series' },
      { key: 'studies', label: 'Studies' },
      { key: 'artists', label: 'Artists' },
    ],
  },
];

export const BUBBLES: DialBubble[] = HOUSES.map((h) => h.bubble);

export const findHouse = (key: string): ArtHouse | undefined =>
  HOUSES.find((h) => h.bubble.key === key);
