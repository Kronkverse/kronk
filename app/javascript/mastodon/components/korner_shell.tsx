import { useLocation } from 'react-router-dom';

import { Stage } from './stage';

// KornerShell — the canonical shell every /hub/<slug> korner sits in.
//
// The Kronk Frame already provides three chrome slots (AutoSpaceBadge,
// AutoSpaceIntro, AutoSpaceViewPicker) via the manifest. This shell
// completes the deal: it owns the Stage + the URL-to-view routing so
// a korner only ever declares its views map + an outer wrapper. The
// shape stays identical across every korner, and adherence to
// Standard L11 becomes structurally cheaper than not adhering.
//
// A korner using KornerShell:
//
//   export const Klot = () => (
//     <KornerShell
//       slug='klot'
//       label='Klot'
//       className='scrollable klot'
//       defaultView='mine'
//       views={{
//         mine: () => <KlotMineView />,
//         circle: () => <KlotCircleView />,
//       }}
//     >
//       <p className='klot__sovereignty'>...</p>
//     </KornerShell>
//   );
//
// The `views` keys MUST match the manifest's `views:` list (same
// keys, same order — the first one is the default). AutoSpaceViewPicker
// reads the manifest for the tab labels; KornerShell reads the URL
// for the current view. One source of truth, two consumers.
//
// Views are declared as thunks so the inactive ones don't mount and
// don't run their effects until they become active. `children` renders
// after the active view — the right place for a per-korner footer
// (a sovereignty note, a disclaimer, an activity strip) that shouldn't
// live in any single view.
//
// Read docs/kronk_frame.md and docs/korners/korner_standard.md L11.

type ViewFactory = () => React.ReactNode;

interface KornerShellProps {
  slug: string;
  label: string;
  defaultView: string;
  views: Record<string, ViewFactory>;
  className?: string;
  children?: React.ReactNode;
}

export const KornerShell: React.FC<KornerShellProps> = ({
  slug,
  label,
  defaultView,
  views,
  className,
  children,
}) => {
  const { pathname } = useLocation();
  const prefix = `/hub/${slug}`;
  const rest = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length).replace(/^\//, '').split('/')[0]
    : undefined;
  const activeKey = rest && views[rest] ? rest : defaultView;
  const factory = views[activeKey] ?? views[defaultView];

  return (
    <Stage label={label}>
      <div className={className}>
        {factory?.()}
        {children}
      </div>
    </Stage>
  );
};
