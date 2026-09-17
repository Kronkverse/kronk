import type { Meta, StoryObj } from '@storybook/react-vite';

import { HubSwitcher } from './hub_switcher';

// Kronk's Me / Home / Hub / Nudges four-way switcher. Renders the
// Membrane (flat pillars + gliding pool of light) on desktop, drops to
// a bottom tab bar on mobile.

const meta = {
  title: 'Chrome/HubSwitcher',
  component: HubSwitcher,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'radio',
      options: ['top', 'bottom'],
    },
    currentAccountUsername: {
      control: 'text',
    },
  },
} satisfies Meta<typeof HubSwitcher>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Top: Story = {
  args: {
    variant: 'top',
    currentAccountUsername: 'tal',
  },
  render: (args) => (
    <div style={{ padding: '2rem', background: '#000', minWidth: '30rem' }}>
      <HubSwitcher {...args} />
    </div>
  ),
};

export const Bottom: Story = {
  args: {
    variant: 'bottom',
    currentAccountUsername: 'tal',
  },
  render: (args) => (
    <div
      style={{
        padding: '2rem',
        background: '#000',
        minWidth: '20rem',
        height: '10rem',
        position: 'relative',
      }}
    >
      <HubSwitcher {...args} />
    </div>
  ),
};

export const NotSignedIn: Story = {
  args: {
    variant: 'top',
  },
  render: Top.render,
};
