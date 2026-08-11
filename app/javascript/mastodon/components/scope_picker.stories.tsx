import { useCallback, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { AccountLite } from './account_multi_select';
import type { VisibilityScope } from './scope_picker';
import { ScopePicker } from './scope_picker';

// The canonical two-question scope conversation. Both axes are additive
// (2026-08-11): a reach tier + krews for audience; an open/restricted base +
// a roster of krews ∪ people for contribution.
//
// Stories bind against `Harness` rather than `ScopePicker` directly so they
// don't have to supply the controlled-component props — the Harness owns the
// state. (The krew sub-pickers fetch the viewer's krews from the API, which is
// empty in Storybook, so they render their empty state.)

const ALL_VIS: readonly VisibilityScope[] = [
  'self_only',
  'mates',
  'orbit',
  'public',
];

interface HarnessProps {
  visibilityOptions?: readonly VisibilityScope[];
  initialVisibility?: VisibilityScope;
  initialOpen?: boolean;
  disabled?: boolean;
}

const Harness: React.FC<HarnessProps> = ({
  visibilityOptions = ALL_VIS,
  initialVisibility = 'mates',
  initialOpen = true,
  disabled,
}) => {
  const [visibility, setVisibility] =
    useState<VisibilityScope>(initialVisibility);
  const [audienceKrewIds, setAudienceKrewIds] = useState<string[]>([]);
  const [contributionOpen, setContributionOpen] = useState(initialOpen);
  const [contributorKrewIds, setContributorKrewIds] = useState<string[]>([]);
  const [contributorAccounts, setContributorAccounts] = useState<AccountLite[]>(
    [],
  );

  const toggle = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => {
      setter((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    },
    [],
  );
  const onToggleAudienceKrew = useCallback(
    (id: string) => {
      toggle(setAudienceKrewIds, id);
    },
    [toggle],
  );
  const onToggleContributorKrew = useCallback(
    (id: string) => {
      toggle(setContributorKrewIds, id);
    },
    [toggle],
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '30rem', background: '#141420' }}>
      <ScopePicker
        visibilityOptions={visibilityOptions}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        audienceKrewIds={audienceKrewIds}
        onToggleAudienceKrew={onToggleAudienceKrew}
        contributionOpen={contributionOpen}
        onContributionOpenChange={setContributionOpen}
        contributorKrewIds={contributorKrewIds}
        onToggleContributorKrew={onToggleContributorKrew}
        contributorAccounts={contributorAccounts}
        onContributorAccountsChange={setContributorAccounts}
        disabled={disabled}
      />
    </div>
  );
};

const meta = {
  title: 'Chrome/ScopePicker',
  component: Harness,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

// Albutts default — the four reach tiers, contribution open.
export const Albutts: Story = {
  args: {},
};

// Restricted contribution — shows the contributor krew + people sub-pickers.
export const RestrictedContribution: Story = {
  args: {
    initialVisibility: 'mates',
    initialOpen: false,
  },
};

// Locked-in state (post-publish read-only view).
export const Disabled: Story = {
  args: {
    initialVisibility: 'public',
    disabled: true,
  },
};
