import { useCallback, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  VisibilityScope,
  ContributionRoster,
  ScopePickerMeta,
} from './scope_picker';
import { ScopePicker } from './scope_picker';

// The canonical two-question scope conversation shared across every
// korner that scopes visibility + contribution. Stories cover: the
// Albutts default (all five visibilities, all five contributions),
// a status-composer-style subset, and the disabled state.

const meta = {
  title: 'Chrome/ScopePicker',
  component: ScopePicker,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ScopePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

const ALL_VIS: readonly VisibilityScope[] = [
  'self_only',
  'mates',
  'orbit',
  'krew',
  'public',
];
const ALL_CONTRIB: readonly ContributionRoster[] = [
  'open',
  'closed',
  'invited',
  'krew',
  'event',
];

interface HarnessProps {
  visibilityOptions?: readonly VisibilityScope[];
  contributionOptions?: readonly ContributionRoster[];
  initialVisibility?: VisibilityScope;
  initialContribution?: ContributionRoster;
  disabled?: boolean;
}

// Controlled-state harness so each story is fully interactive in
// Storybook — click a chip and see the state flip.
const Harness: React.FC<HarnessProps> = ({
  visibilityOptions = ALL_VIS,
  contributionOptions = ALL_CONTRIB,
  initialVisibility = 'mates',
  initialContribution = 'open',
  disabled,
}) => {
  const [visibility, setVisibility] =
    useState<VisibilityScope>(initialVisibility);
  const [contribution, setContribution] =
    useState<ContributionRoster>(initialContribution);
  const [krewIds, setKrewIds] = useState<string[]>([]);

  const onVisibilityChange = useCallback(
    (v: VisibilityScope, meta?: ScopePickerMeta) => {
      setVisibility(v);
      if (meta?.krewIds) setKrewIds(meta.krewIds);
    },
    [],
  );
  const onContributionChange = useCallback(
    (c: ContributionRoster, meta?: ScopePickerMeta) => {
      setContribution(c);
      if (meta?.krewIds) setKrewIds(meta.krewIds);
    },
    [],
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '30rem', background: '#141420' }}>
      <ScopePicker
        visibilityOptions={visibilityOptions}
        contributionOptions={contributionOptions}
        visibility={visibility}
        contribution={contribution}
        krewIds={krewIds}
        onVisibilityChange={onVisibilityChange}
        onContributionChange={onContributionChange}
        disabled={disabled}
      />
      <pre
        style={{
          marginTop: '1rem',
          fontSize: 11,
          color: '#8880a8',
          fontFamily: 'monospace',
        }}
      >
        {JSON.stringify({ visibility, contribution, krewIds }, null, 2)}
      </pre>
    </div>
  );
};

// Albutts-style — all five visibility scopes, all five contribution
// rosters. Default: 'mates' + 'open'.
export const Albutts: Story = {
  render: () => <Harness />,
};

// Status-composer style — no self_only or orbit (statuses don't
// have those semantics); no `invited` or `event` contribution
// (statuses are always open-within-scope; a reply either fits the
// visibility or doesn't).
export const StatusComposer: Story = {
  render: () => (
    <Harness
      visibilityOptions={['mates', 'krew', 'public']}
      contributionOptions={['open']}
      initialVisibility='public'
      initialContribution='open'
    />
  ),
};

// Locked-in state (for post-publish read-only view).
export const Disabled: Story = {
  render: () => (
    <Harness initialVisibility='krew' initialContribution='closed' disabled />
  ),
};
