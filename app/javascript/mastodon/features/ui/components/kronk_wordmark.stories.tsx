import type { Meta, StoryObj } from '@storybook/react-vite';

import { KronkWordmark } from './kronk_wordmark';

// Kronk wordmark — canonical brand mark. Sits in the top-band chrome
// throughout the app; also renders as a hero on the signed-out
// landing. Same 5-span structure, --font-display + --kronk-purple-*
// tokens; three size variants (chrome / hero / inline).

const meta = {
  title: 'Chrome/KronkWordmark',
  component: KronkWordmark,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof KronkWordmark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Chrome: Story = {
  args: { size: 'chrome' },
  render: (args) => (
    <div style={{ padding: '2rem', background: '#000', minWidth: '10rem' }}>
      <KronkWordmark {...args} />
    </div>
  ),
};

export const Hero: Story = {
  args: { size: 'hero' },
  render: (args) => (
    <div
      style={{
        padding: '3rem 2rem',
        background: '#000',
        minWidth: '20rem',
        textAlign: 'center',
      }}
    >
      <KronkWordmark {...args} />
    </div>
  ),
};

export const Inline: Story = {
  args: { size: 'inline' },
  render: (args) => (
    <div
      style={{
        padding: '2rem',
        background: '#000',
        color: '#eee',
        fontSize: '1rem',
        lineHeight: 1.6,
      }}
    >
      Welcome to <KronkWordmark {...args} /> — a small community.
    </div>
  ),
};
