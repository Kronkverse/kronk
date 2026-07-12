import type { Meta, StoryObj } from '@storybook/react-vite';

import { KornerSubBar } from './korner_sub_bar';

// Breadcrumb pill shown when inside a Korner (/hub/<slug>/*).
// Vanishes when the route is not inside a Korner.

const meta = {
  title: 'Chrome/KornerSubBar',
  component: KornerSubBar,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof KornerSubBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InsideKorner: Story = {
  parameters: { reactRouter: { location: '/hub/kommons' } },
  render: () => (
    <div
      style={{
        padding: '4rem',
        background: '#000',
        minWidth: '30rem',
        minHeight: '10rem',
        position: 'relative',
      }}
    >
      <KornerSubBar />
    </div>
  ),
};

export const NotInsideKorner: Story = {
  parameters: { reactRouter: { location: '/home' } },
  render: InsideKorner.render,
};
