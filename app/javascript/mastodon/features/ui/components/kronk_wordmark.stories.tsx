import type { Meta, StoryObj } from '@storybook/react-vite';

import { KronkWordmark } from './kronk_wordmark';

// Kronk wordmark — top-left of the chrome strip. Links to /kronk (the
// org space). Uses --font-display + --kronk-purple-accent tokens.
// A single visual variant.

const meta = {
  title: 'Chrome/KronkWordmark',
  component: KronkWordmark,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof KronkWordmark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ padding: '2rem', background: '#000', minWidth: '10rem' }}>
      <KronkWordmark />
    </div>
  ),
};
