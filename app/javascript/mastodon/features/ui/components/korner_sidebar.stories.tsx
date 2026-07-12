import type { Meta, StoryObj } from '@storybook/react-vite';

import { KornerSidebar } from './korner_sidebar';

// Icon-only Korner rail (right-mounted, ≥1200px viewport).
// Recency-driven order via localStorage; icons only, name on hover.
// Storybook renders the empty state — populating requires the redux
// slice for korners which the preview decorator seeds when needed.

const meta = {
  title: 'Chrome/KornerSidebar',
  component: KornerSidebar,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof KornerSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div
      style={{
        position: 'relative',
        minHeight: '30rem',
        background: '#000',
        width: '100%',
      }}
    >
      <KornerSidebar />
    </div>
  ),
};
