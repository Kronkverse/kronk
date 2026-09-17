import type { Meta, StoryObj } from '@storybook/react-vite';

import { KronkMenu } from './kronk_menu';

// The Ж menu — bottom-right FAB with a spring-in panel.
// Trimmed to four verbs: Post / Nudges / Search / Settings.
// Settings entry is context-aware.

const meta = {
  title: 'Chrome/KronkMenu',
  component: KronkMenu,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof KronkMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  render: () => (
    <div
      style={{
        padding: '4rem',
        background: '#000',
        minWidth: '20rem',
        minHeight: '20rem',
        position: 'relative',
      }}
    >
      <KronkMenu />
    </div>
  ),
};

export const OpenInHome: Story = {
  parameters: { reactRouter: { location: '/home' } },
  render: Closed.render,
};

export const OpenInKorner: Story = {
  parameters: { reactRouter: { location: '/hub/kommons' } },
  render: Closed.render,
};

export const OpenInProfile: Story = {
  parameters: { reactRouter: { location: '/@tal' } },
  render: Closed.render,
};
