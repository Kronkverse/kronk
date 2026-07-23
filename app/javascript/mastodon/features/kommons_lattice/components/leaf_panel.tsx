import { FormattedMessage } from 'react-intl';

import { NodeProposals } from '../../kommons_tree/components/node_proposals';
import type { MapNode } from '../../kommons_tree/data/layout';

// The leaf panel (spec §7). Selecting a node with a URL — a real page, not a
// branch — opens this in the next column, attached to its row, so content sits
// in the lattice rather than a modal or a side rail. The proposals list drills
// from the page to the feedback on it; the cross-branch "wired to" list is a
// later addition.
interface Props {
  node: MapNode;
  x: number;
  y: number;
  onPlant: () => void;
  onClose: () => void;
}

export const LeafPanel: React.FC<Props> = ({
  node,
  x,
  y,
  onPlant,
  onClose,
}) => (
  <div
    className='lattice-panel'
    style={{ transform: `translate(${x}px, ${y}px)` }}
  >
    <button
      type='button'
      className='lattice-panel__close'
      onClick={onClose}
      aria-label='Close'
    >
      ×
    </button>

    <h3 className='lattice-panel__title'>{node.label}</h3>
    {node.url && <span className='lattice-panel__url'>{node.url}</span>}
    <span
      className={`lattice-panel__lifecycle lattice-panel__lifecycle--${
        node.lifecycle ?? 'live'
      }`}
    >
      {node.lifecycle ?? 'live'}
    </span>

    <div className='lattice-panel__stat'>
      <FormattedMessage
        id='kommons_lattice.panel.open'
        defaultMessage='{count, plural, one {# open proposal} other {# open proposals}}'
        values={{ count: node.count }}
      />
    </div>

    <NodeProposals nodeId={node.id} />

    <button type='button' className='lattice-panel__plant' onClick={onPlant}>
      <FormattedMessage
        id='kommons_lattice.panel.plant'
        defaultMessage='Plant feedback here'
      />
    </button>
  </div>
);
