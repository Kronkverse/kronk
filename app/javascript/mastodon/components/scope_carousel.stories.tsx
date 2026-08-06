import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ScopeFace } from './scope_carousel';
import { ScopeCarousel } from './scope_carousel';

// The shared "rotating stand" scope selector. Stories cover both sizes:
// LARGE = the feed view selector (what you see), SMALL = the compose reach
// selector (who can see this). Bound through a controlled Harness so the
// barrel actually turns in Storybook.

const VIEW_FACES: ScopeFace[] = [
  {
    key: 'kronk',
    label: 'Kronk',
    desc: 'Everything the whole place is saying.',
    count: '142 MEMBERS',
    mark: 'kronk',
  },
  {
    key: 'orbit',
    label: 'Orbit',
    desc: 'Your mates, and theirs. One ring out.',
    count: '58 PEOPLE',
    mark: 'orbit',
  },
  {
    key: 'mates',
    label: 'Mates',
    desc: 'Only the people you’ve bonded with.',
    count: '23 PEOPLE',
    mark: 'mates',
  },
  {
    key: 'krews',
    label: 'Krews',
    desc: 'The rooms you’re in, whoever is in them.',
    count: '5 KREWS',
    mark: 'krews',
  },
];

const REACH_FACES: ScopeFace[] = [
  {
    key: 'self',
    label: 'Self',
    desc: 'Your timeline only. Nobody’s feed.',
    mark: 'self',
  },
  { key: 'mates', label: 'Mates', desc: '23 bonded people.', mark: 'mates' },
  {
    key: 'orbit',
    label: 'Orbit',
    desc: 'Mates and theirs — 58.',
    mark: 'orbit',
  },
  { key: 'kronk', label: 'Kronk', desc: 'Everyone here. 142.', mark: 'kronk' },
  { key: 'krews', label: 'Krews', desc: 'Chosen rooms only.', mark: 'krews' },
];

interface HarnessProps {
  faces: ScopeFace[];
  initial: string;
  size: 'large' | 'small';
  ariaLabel: string;
}

const Harness: React.FC<HarnessProps> = ({
  faces,
  initial,
  size,
  ariaLabel,
}) => {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ maxWidth: 480, margin: '2rem auto' }}>
      <ScopeCarousel
        faces={faces}
        value={value}
        onChange={setValue}
        size={size}
        ariaLabel={ariaLabel}
      />
      <p
        style={{
          textAlign: 'center',
          marginTop: '1rem',
          color: 'var(--text-muted)',
        }}
      >
        selected: <b>{value}</b>
      </p>
    </div>
  );
};

const meta = {
  title: 'Components/ScopeCarousel',
  component: Harness,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

// LARGE — the feed view selector (what you want to see).
export const FeedView: Story = {
  args: {
    faces: VIEW_FACES,
    initial: 'kronk',
    size: 'large',
    ariaLabel: 'Choose what you see',
  },
};

// SMALL — the compose reach selector (who can see this).
export const ComposeReach: Story = {
  args: {
    faces: REACH_FACES,
    initial: 'mates',
    size: 'small',
    ariaLabel: 'Choose who can see this',
  },
};
