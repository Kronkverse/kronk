import { useCallback } from 'react';

import type { Phase } from 'mastodon/api/klot';
import {
  arcPath,
  moonMarkup,
  ptFor,
  ranges,
  R,
} from 'mastodon/features/klot/geometry';

// CycleRing — SVG ring shared by Mine (own cycle) and Circle (inbound
// friends). Both views feed in cycle_length + period_length and the
// active phase; Mine additionally places a "today" orb, Circle
// distributes friend moons across their current phase arcs.

interface FriendMoon {
  id: string;
  name: string;
  phase: Phase;
}

interface CycleRingProps {
  cycleLength: number;
  periodLength: number;
  activePhase: Phase | null;
  // Optional day-of-cycle to render the "today" orb (Mine view). When
  // omitted (Circle view), no orb renders and all arcs sit dim so the
  // moons carry the eye.
  currentDay?: number | null;
  // Optional list of friend moons distributed along their phase's arc.
  friends?: FriendMoon[];
  // ID of the selected friend, if any — draws a highlight ring.
  selectedFriendId?: string | null;
  // Called when a friend moon is tapped (Circle view).
  onSelectFriend?: (id: string) => void;
}

export const CycleRing: React.FC<CycleRingProps> = ({
  cycleLength,
  periodLength,
  activePhase,
  currentDay,
  friends,
  selectedFriendId,
  onSelectFriend,
}) => {
  const bands = ranges(cycleLength, periodLength);

  const arcMarkup = bands
    .map((band) => {
      const dim = band.key === activePhase ? '' : ' klot-ring__arc--dim';
      const path = arcPath(band.a - 1 + 0.35, band.b - 0.35, cycleLength);
      return `<path class="klot-ring__arc${dim}" stroke="var(--klot-${band.key})" d="${path}"/>`;
    })
    .join('');

  // Small phase moons at each band's midpoint — labels the arcs.
  const bandMoons = bands
    .map((band) => {
      const mid = (band.a - 1 + band.b) / 2;
      const [mx, my] = ptFor(mid, cycleLength);
      return moonMarkup(`km-${band.key}`, mx, my, 11, band.key);
    })
    .join('');

  // Today / current-day orb (Mine view only).
  let orbMarkup = '';
  if (currentDay && activePhase) {
    const [ox, oy] = ptFor(currentDay - 0.5, cycleLength);
    orbMarkup =
      `<circle class="klot-ring__halo" cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="20" fill="var(--klot-${activePhase})"/>` +
      `<circle cx="${ox.toFixed(1)}" cy="${oy.toFixed(1)}" r="13" fill="var(--surface-primary)" stroke="var(--klot-${activePhase})" stroke-width="2"/>` +
      moonMarkup('klot-orb', ox, oy, 8.5, activePhase);
  }

  // Friend moons on their phase arc (Circle view only). Distribute
  // multiple friends in the same phase evenly along the arc so they
  // don't stack on top of each other.
  const friendGroups = new Map<Phase, FriendMoon[]>();
  (friends ?? []).forEach((f) => {
    const list = friendGroups.get(f.phase) ?? [];
    list.push(f);
    friendGroups.set(f.phase, list);
  });

  const handleClick = useCallback<React.MouseEventHandler<SVGSVGElement>>(
    (e) => {
      if (!onSelectFriend) return;
      const target = e.target as SVGElement;
      const g = target.closest('[data-friend-id]');
      if (!g) return;
      const id = g.getAttribute('data-friend-id');
      if (id) onSelectFriend(id);
    },
    [onSelectFriend],
  );

  return (
    <svg
      viewBox='0 0 340 340'
      className='klot-ring'
      aria-label='Cycle ring'
      dangerouslySetInnerHTML={{
        __html: `<g class="klot-ring__arcs">${arcMarkup}${bandMoons}</g>${orbMarkup}${buildFriendMarkup(friendGroups, bands, cycleLength, selectedFriendId)}`,
      }}
      onClick={handleClick}
    />
  );
};

function buildFriendMarkup(
  groups: Map<Phase, FriendMoon[]>,
  bands: ReturnType<typeof ranges>,
  cycleLength: number,
  selectedFriendId?: string | null,
): string {
  if (groups.size === 0) return '';

  const parts: string[] = [];
  groups.forEach((list, phase) => {
    const band = bands.find((b) => b.key === phase);
    if (!band) return;
    const t0 = band.a - 1;
    const t1 = band.b;
    list.forEach((friend, idx) => {
      const t = t0 + ((idx + 1) / (list.length + 1)) * (t1 - t0);
      const [x, y] = ptFor(t, cycleLength);
      const dx = x - 170;
      const dy = y - 170;
      const len = Math.hypot(dx, dy) || 1;
      const lx = 170 + (dx / len) * (R + 15);
      const ly = 170 + (dy / len) * (R + 15);
      const anchor = dx >= 0 ? 'start' : 'end';
      const selected = selectedFriendId === friend.id;
      let g = `<g class="klot-ring__friend" data-friend-id="${friend.id}" style="cursor:pointer">`;
      if (selected) {
        g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="none" stroke="var(--klot-${phase})" stroke-width="2"/>`;
      }
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="transparent"/>`;
      g += moonMarkup(`kfm-${friend.id}`, x, y, 9, phase);
      g += `<text x="${(lx + (anchor === 'start' ? 2 : -2)).toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" class="klot-ring__friend-label ${selected ? 'klot-ring__friend-label--active' : ''}">${escapeXml(friend.name)}</text>`;
      g += '</g>';
      parts.push(g);
    });
  });

  return parts.join('');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
