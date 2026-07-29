// Mates timeline — subject's community drawn as a time-anchored line.
//
// The subject's own membership is a weighted horizontal track from
// their join date to today. Above the line: their mates, each at the
// bond date. Below the line: the people they invited, each at that
// member's join date. At the head: the person who invited them,
// linked to the leftmost cap. Clicking any tile makes that member
// the subject; the view rebuilds around their line.
//
// Design source: KRONK_KOMMUNITY.md (attached to Kommons proposal
// "Mates" #116990859270976043). MVP scope for this pass — line +
// two rows + inviter head + subject switching + hover tooltip. See
// docs/spaces/mates_tab.md for what's deferred (branches, lineage
// trace, sub-lane packing, search).
//
// Data is bundled synthesised (real degree-and-follow sequence from
// the orb, with invented join dates + invite chain + mate bond dates)
// until the Mates endpoint lands. `useMatesTimeline` is the swap
// point.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FormattedMessage } from 'react-intl';

import { ContactsRail } from './contacts_rail';
import { DetailPanel } from './detail_panel';
import type {
  MateBond,
  MatesTimelineData,
  TimelineMember,
} from './use_mates_timeline';
import { useMatesTimeline } from './use_mates_timeline';

// ── Geometry (per brief) ───────────────────────────────────────────
const HEAD_TILE = 34;
const BASE_TILE = 28;
const BRANCH_TILE = 20; // opened-branch tiles are smaller (brief § Geometry)
const TRACK_HEIGHT = 56;
const LINE_TO_ROW = 54;
const BRANCH_PITCH = 42; // brief default (compresses to 26-34px as layers accumulate)
const PIP_RADIUS = 7;
// Spread ratio — brief zoom range is 0.35–6 px/day (all-time to
// week-view). Anchoring to ~4 keeps handles legible and gives close
// mate-bond dates room to breathe without piling into sub-lanes. Old
// history is still accessible via horizontal scroll (the SVG is
// auto-scrolled to today on mount).
const PX_PER_DAY = 4;
const LEFT_MARGIN = 40;
const RIGHT_MARGIN = 40;
const ROW_HEIGHT = 96; // room for tile + label
const AXIS_MARK_INTERVAL_DAYS = 90; // ~quarterly ticks
const MAX_LAYOUT_PASSES = 26;
const SUBLANE_GAP = 4; // px between stacked sub-lanes

// Greedy sub-lane packing: sort tiles by x, place each in the lowest
// lane whose most-recent tile is at least (tileSize + SUBLANE_GAP) to
// the left. Returns id → lane index (0 = base lane, higher = pushed
// out from the line). Sub-lanes are a packing artefact, not a
// semantic layer (per brief § Rows pack into sub-lanes).
const packSubLanes = (
  tiles: readonly { id: string; x: number }[],
  tileSize: number,
): Map<string, number> => {
  const minSeparation = tileSize + SUBLANE_GAP;
  const sorted = [...tiles].sort((a, b) => a.x - b.x);
  const laneLastX: number[] = [];
  const laneByTile = new Map<string, number>();
  sorted.forEach((tile) => {
    let lane = 0;
    while (lane < laneLastX.length) {
      const last = laneLastX[lane];
      if (last === undefined || tile.x - last >= minSeparation) break;
      lane += 1;
    }
    laneLastX[lane] = tile.x;
    laneByTile.set(tile.id, lane);
  });
  return laneByTile;
};

// How much vertical space is consumed by a stack of N sub-lanes.
const laneOffset = (lane: number, tileSize: number): number =>
  lane * (tileSize + SUBLANE_GAP);

const dayIndex = (iso: string, anchorIso: string): number => {
  const anchor = new Date(anchorIso).getTime();
  const day = new Date(iso).getTime();
  return Math.round((day - anchor) / 86_400_000);
};

const formatShort = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

interface TileInfo {
  member: TimelineMember;
  x: number;
  label: string;
  detail?: string; // e.g. "mate since <date>"
}

// Hover state split into two: `hoveredMember` (rarely changes — only
// on tile enter/leave) drives the lineage trace and tooltip content;
// tooltip *position* is updated per-mousemove via a ref on the
// tooltip div (no re-render). Before this split, onMouseMove churned
// setState 60Hz → whole SVG re-render → visible flicker on hover.
interface HoverMember {
  member: TimelineMember;
  detail?: string;
}

const findMatesForSubject = (
  subjectId: string,
  mates: readonly MateBond[],
  membersById: Map<string, TimelineMember>,
): { member: TimelineMember; mates_since: string }[] => {
  const result: { member: TimelineMember; mates_since: string }[] = [];
  mates.forEach((bond) => {
    let otherId: string | null = null;
    if (bond.member_a === subjectId) otherId = bond.member_b;
    else if (bond.member_b === subjectId) otherId = bond.member_a;
    if (!otherId) return;
    const other = membersById.get(otherId);
    if (!other) return;
    result.push({ member: other, mates_since: bond.mates_since });
  });
  return result;
};

const findInviteesForSubject = (
  subjectId: string,
  members: readonly TimelineMember[],
): TimelineMember[] => members.filter((m) => m.inviter_id === subjectId);

export const MatesTimeline = ({ viewerHandle }: { viewerHandle?: string }) => {
  const data: MatesTimelineData = useMatesTimeline();
  const membersById = useMemo(() => {
    const map = new Map<string, TimelineMember>();
    data.members.forEach((m) => map.set(m.id, m));
    return map;
  }, [data.members]);

  const viewerMember = useMemo(
    () => data.members.find((m) => m.handle === viewerHandle),
    [data.members, viewerHandle],
  );

  const initialSubjectId = viewerMember?.id ?? data.members[0]?.id ?? '';
  const [subjectId, setSubjectId] = useState<string>(initialSubjectId);
  const [trail, setTrail] = useState<string[]>([initialSubjectId]);
  const subject = membersById.get(subjectId);
  const [hoveredMember, setHoveredMember] = useState<HoverMember | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Cache last mouse position outside React state so mouse-move
  // updates never re-render. useLayoutEffect below reads this to
  // place the tooltip immediately after it mounts on hover-enter.
  const lastMousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Opened branch keys — `a/id` opens the mate/inviter's full invite
  // chain (upward), `b/id` opens one generation of an invitee's own
  // invitees (downward). Cleared on subject switch so the new subject
  // starts with only their two base rows.
  const [openedKeys, setOpenedKeys] = useState<Set<string>>(new Set());

  const {
    xForDay,
    todayDay,
    svgWidth,
    svgHeight,
    matesRowY,
    inviteesRowY,
    lineY,
  } = useMemo(() => {
    const today = new Date();
    const anchor = new Date(data.anchor_date);
    const todayDayVal = Math.max(
      1,
      Math.round((today.getTime() - anchor.getTime()) / 86_400_000),
    );
    const width = LEFT_MARGIN + todayDayVal * PX_PER_DAY + RIGHT_MARGIN;
    // Layout: mates row on top, then track, then invitees row below.
    const lineYVal = ROW_HEIGHT + TRACK_HEIGHT / 2;
    const matesRowYVal = ROW_HEIGHT - LINE_TO_ROW + TRACK_HEIGHT / 2;
    const inviteesRowYVal = lineYVal + LINE_TO_ROW;
    const height = inviteesRowYVal + ROW_HEIGHT;
    return {
      xForDay: (d: number) => LEFT_MARGIN + d * PX_PER_DAY,
      todayDay: todayDayVal,
      svgWidth: width,
      svgHeight: height,
      matesRowY: matesRowYVal,
      inviteesRowY: inviteesRowYVal,
      lineY: lineYVal,
    };
  }, [data.anchor_date]);

  const matesTiles: TileInfo[] = useMemo(() => {
    if (!subject) return [];
    return findMatesForSubject(subject.id, data.mates, membersById)
      .map(({ member, mates_since }) => ({
        member,
        x: xForDay(dayIndex(mates_since, data.anchor_date)),
        label: member.handle,
        detail: `mate since ${formatShort(mates_since)}`,
      }))
      .sort((a, b) => a.x - b.x);
  }, [subject, data.mates, data.anchor_date, membersById, xForDay]);

  const inviteesTiles: TileInfo[] = useMemo(() => {
    if (!subject) return [];
    return findInviteesForSubject(subject.id, data.members)
      .map((member) => ({
        member,
        x: xForDay(dayIndex(member.joined_at, data.anchor_date)),
        label: member.handle,
        detail: `joined ${formatShort(member.joined_at)}`,
      }))
      .sort((a, b) => a.x - b.x);
  }, [subject, data.members, data.anchor_date, xForDay]);

  const inviter = useMemo(() => {
    if (!subject?.inviter_id) return null;
    return membersById.get(subject.inviter_id) ?? null;
  }, [subject, membersById]);

  // Sub-lane packing for the base mates row. The inviter tile also
  // lives on this row (at its own join date), so it joins the pack
  // to avoid colliding with the leftmost mate.
  const matesRowLanes = useMemo(() => {
    const tiles: { id: string; x: number }[] = matesTiles.map((tile) => ({
      id: tile.member.id,
      x: tile.x,
    }));
    if (inviter) {
      tiles.push({
        id: inviter.id,
        x: xForDay(dayIndex(inviter.joined_at, data.anchor_date)),
      });
    }
    return packSubLanes(tiles, BASE_TILE);
  }, [matesTiles, inviter, xForDay, data.anchor_date]);

  const inviteesRowLanes = useMemo(() => {
    const tiles = inviteesTiles.map((tile) => ({
      id: tile.member.id,
      x: tile.x,
    }));
    return packSubLanes(tiles, BASE_TILE);
  }, [inviteesTiles]);

  const onTileClick = useCallback((id: string) => {
    setSubjectId(id);
    setTrail((prev) => {
      // Don't duplicate the current tail (no-op clicks) or re-push on
      // trail-entry clicks (those handle truncation themselves).
      if (prev[prev.length - 1] === id) return prev;
      return [...prev, id];
    });
    setHoveredMember(null);
    setOpenedKeys(new Set()); // subject switch closes every opened branch
  }, []);

  // Click a trail entry → jump back to that member; truncate the trail
  // to end at that entry so further clicks continue building from there.
  const onTrailClick = useCallback((idx: number) => {
    setTrail((prev) => {
      const next = prev.slice(0, idx + 1);
      const target = next[next.length - 1];
      if (target) setSubjectId(target);
      return next;
    });
    setHoveredMember(null);
    setOpenedKeys(new Set());
  }, []);

  // Escape returns to the viewer's own line — the panic-button
  // convention from the brief. No-op if the viewer isn't in the data.
  useEffect(() => {
    if (!viewerMember) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setSubjectId(viewerMember.id);
      setTrail([viewerMember.id]);
      setHoveredMember(null);
      setOpenedKeys(new Set());
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [viewerMember]);

  const onTileHoverEnter = useCallback((info: HoverMember | null) => {
    setHoveredMember(info);
  }, []);

  // Position updates go through the ref — no state, no re-render.
  const onTileHoverMove = useCallback((clientX: number, clientY: number) => {
    lastMousePos.current = { x: clientX, y: clientY };
    const el = tooltipRef.current;
    if (!el) return;
    el.style.left = `${clientX + 14}px`;
    el.style.top = `${clientY + 16}px`;
  }, []);

  const togglePip = useCallback(
    (key: string) => {
      setOpenedKeys((prev) => {
        const next = new Set(prev);
        if (!next.has(key)) {
          next.add(key);
          return next;
        }
        next.delete(key);
        // Downward cascade: closing an invitee's line also closes every
        // downward key opened beneath it (per brief § Branches).
        if (key.startsWith('b/')) {
          const closedId = key.slice(2);
          [...next].forEach((otherKey) => {
            if (!otherKey.startsWith('b/')) return;
            let cur = membersById.get(otherKey.slice(2));
            while (cur?.inviter_id) {
              if (cur.inviter_id === closedId) {
                next.delete(otherKey);
                break;
              }
              const parent: TimelineMember | undefined = membersById.get(
                cur.inviter_id,
              );
              cur = parent;
            }
          });
        }
        return next;
      });
    },
    [membersById],
  );

  // ── Upward branch layout (mates/inviter chains) ────────────────
  const upwardBranches = useMemo(() => {
    interface UpNode {
      readonly id: string;
      readonly day: number;
      readonly base: boolean;
    }
    interface UpLink {
      readonly childId: string;
      readonly parentId: string;
    }

    if (!subject)
      return {
        nodes: new Map<string, UpNode>(),
        links: [] as UpLink[],
        layer: new Map<string, number>(),
        laneByTile: new Map<string, number>(),
        maxLaneByLayer: new Map<number, number>(),
      };

    // Base = mates + inviter. Both live in the base row (layer 0). We
    // reuse the base positions already computed in matesTiles/inviter.
    const nodes = new Map<string, UpNode>();
    matesTiles.forEach((tile) => {
      const bondDay = dayIndex(
        (tile.detail ?? '').replace('mate since ', ''),
        data.anchor_date,
      );
      nodes.set(tile.member.id, {
        id: tile.member.id,
        day: bondDay,
        base: true,
      });
    });
    if (inviter) {
      nodes.set(inviter.id, {
        id: inviter.id,
        day: dayIndex(inviter.joined_at, data.anchor_date),
        base: true,
      });
    }

    // Walk up the invite chain for every opened base key. Merging:
    // a shared ancestor is only added once; a link (child, parent)
    // is only added once via an edgeSet guard.
    const baseIds = [...nodes.keys()];
    const links: UpLink[] = [];
    const edgeSet = new Set<string>();
    baseIds.forEach((id) => {
      if (!openedKeys.has(`a/${id}`)) return;
      let cur = membersById.get(id);
      while (cur?.inviter_id) {
        const parent = membersById.get(cur.inviter_id);
        if (!parent) break;
        if (!nodes.has(parent.id)) {
          nodes.set(parent.id, {
            id: parent.id,
            day: dayIndex(parent.joined_at, data.anchor_date),
            base: false,
          });
        }
        const linkKey = `${cur.id}>${parent.id}`;
        if (!edgeSet.has(linkKey)) {
          edgeSet.add(linkKey);
          links.push({ childId: cur.id, parentId: parent.id });
        }
        cur = parent;
      }
    });

    // Iterative longest-path-from-base — layer(parent) >= layer(child) + 1.
    // Base nodes stay at 0; ancestors bubble up until stable.
    const layer = new Map<string, number>();
    nodes.forEach((_, id) => layer.set(id, 0));
    for (let pass = 0; pass < MAX_LAYOUT_PASSES; pass++) {
      const changedRef: { changed: boolean } = { changed: false };
      links.forEach((edge) => {
        const parentLayer = layer.get(edge.parentId) ?? 0;
        const wanted = (layer.get(edge.childId) ?? 0) + 1;
        if (parentLayer < wanted) {
          layer.set(edge.parentId, wanted);
          changedRef.changed = true;
        }
      });
      if (!changedRef.changed) break;
    }
    // Sub-lane packing per non-base layer.
    const laneByTile = new Map<string, number>();
    const maxLaneByLayer = new Map<number, number>();
    const byLayer = new Map<number, { id: string; x: number }[]>();
    nodes.forEach((n) => {
      if (n.base) return;
      const l = layer.get(n.id) ?? 0;
      if (!byLayer.has(l)) byLayer.set(l, []);
      byLayer.get(l)?.push({ id: n.id, x: xForDay(n.day) });
    });
    byLayer.forEach((tiles, l) => {
      const lanes = packSubLanes(tiles, BRANCH_TILE);
      let max = 0;
      lanes.forEach((lane, id) => {
        laneByTile.set(id, lane);
        if (lane > max) max = lane;
      });
      maxLaneByLayer.set(l, max);
    });
    return { nodes, links, layer, laneByTile, maxLaneByLayer };
  }, [
    subject,
    openedKeys,
    matesTiles,
    inviter,
    membersById,
    data.anchor_date,
    xForDay,
  ]);

  // ── Downward branch layout (invite line) ───────────────────────
  const downwardBranches = useMemo(() => {
    interface DownNode {
      readonly id: string;
      readonly day: number;
      readonly depth: number;
      readonly base: boolean;
      readonly parentId: string | null;
    }
    interface DownLink {
      readonly childId: string;
      readonly parentId: string;
    }

    if (!subject)
      return {
        nodes: new Map<string, DownNode>(),
        links: [] as DownLink[],
        laneByTile: new Map<string, number>(),
        maxLaneByDepth: new Map<number, number>(),
      };

    const nodes = new Map<string, DownNode>();
    inviteesTiles.forEach((tile) => {
      nodes.set(tile.member.id, {
        id: tile.member.id,
        day: dayIndex(tile.member.joined_at, data.anchor_date),
        depth: 0,
        base: true,
        parentId: subject.id,
      });
    });

    const links: DownLink[] = [];
    // BFS opening one generation at a time: for each opened invitee,
    // reveal their direct kids. Each of those can be opened in turn.
    const queue: string[] = inviteesTiles.map((tile) => tile.member.id);
    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId) continue;
      if (!openedKeys.has(`b/${parentId}`)) continue;
      const parentNode = nodes.get(parentId);
      if (!parentNode) continue;
      const childDepth = parentNode.depth + 1;
      data.members.forEach((m) => {
        if (m.inviter_id !== parentId) return;
        if (nodes.has(m.id)) return;
        nodes.set(m.id, {
          id: m.id,
          day: dayIndex(m.joined_at, data.anchor_date),
          depth: childDepth,
          base: false,
          parentId,
        });
        links.push({ childId: m.id, parentId });
        queue.push(m.id);
      });
    }
    // Sub-lane packing per non-base depth.
    const laneByTile = new Map<string, number>();
    const maxLaneByDepth = new Map<number, number>();
    const byDepth = new Map<number, { id: string; x: number }[]>();
    nodes.forEach((n) => {
      if (n.base) return;
      if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
      byDepth.get(n.depth)?.push({ id: n.id, x: xForDay(n.day) });
    });
    byDepth.forEach((tiles, d) => {
      const lanes = packSubLanes(tiles, BRANCH_TILE);
      let max = 0;
      lanes.forEach((lane, id) => {
        laneByTile.set(id, lane);
        if (lane > max) max = lane;
      });
      maxLaneByDepth.set(d, max);
    });
    return { nodes, links, laneByTile, maxLaneByDepth };
  }, [
    subject,
    openedKeys,
    inviteesTiles,
    data.members,
    data.anchor_date,
    xForDay,
  ]);

  // How far the opened branches extend above/below the base rows —
  // used to pad the SVG viewBox so tiles never clip. Includes the
  // effect of accumulated sub-lanes at each layer.
  const branchExtents = useMemo(() => {
    let maxUpLayer = 0;
    upwardBranches.layer.forEach((v) => {
      if (v > maxUpLayer) maxUpLayer = v;
    });
    let maxDownDepth = 0;
    downwardBranches.nodes.forEach((n) => {
      if (n.depth > maxDownDepth) maxDownDepth = n.depth;
    });
    // Sub-lane maxes on the base rows (mates + invitees) — they push
    // the branch layers further out from the line.
    let maxMatesLane = 0;
    matesRowLanes.forEach((v) => {
      if (v > maxMatesLane) maxMatesLane = v;
    });
    let maxInviteesLane = 0;
    inviteesRowLanes.forEach((v) => {
      if (v > maxInviteesLane) maxInviteesLane = v;
    });
    // Sub-lane maxes on the top-most upward layer and the bottom-most
    // downward depth so tiles at the extremes don't clip.
    const topLaneExtra = upwardBranches.maxLaneByLayer.get(maxUpLayer) ?? 0;
    const bottomLaneMax =
      downwardBranches.maxLaneByDepth.get(maxDownDepth) ?? 0;
    return {
      maxUpLayer,
      maxDownDepth,
      maxMatesLane,
      maxInviteesLane,
      topLaneExtra,
      bottomLaneMax,
    };
  }, [upwardBranches, downwardBranches, matesRowLanes, inviteesRowLanes]);

  const topPad =
    (branchExtents.maxMatesLane > 0
      ? laneOffset(branchExtents.maxMatesLane, BASE_TILE)
      : 0) +
    (branchExtents.maxUpLayer > 0
      ? branchExtents.maxUpLayer * BRANCH_PITCH +
        BRANCH_TILE +
        laneOffset(branchExtents.topLaneExtra, BRANCH_TILE)
      : 0);
  const bottomPad =
    (branchExtents.maxInviteesLane > 0
      ? laneOffset(branchExtents.maxInviteesLane, BASE_TILE)
      : 0) +
    (branchExtents.maxDownDepth > 0
      ? branchExtents.maxDownDepth * BRANCH_PITCH +
        BRANCH_TILE +
        laneOffset(branchExtents.bottomLaneMax, BRANCH_TILE) +
        16
      : 0);

  // Y-position helpers that fold in sub-lane offsets. Base rows push
  // their sub-lanes away from the line; branch layers stack beyond the
  // base row's max lane so a fully-packed base row and a deep branch
  // never share pixels.
  const matesTileY = useCallback(
    (memberId: string): number =>
      matesRowY - laneOffset(matesRowLanes.get(memberId) ?? 0, BASE_TILE),
    [matesRowY, matesRowLanes],
  );
  const inviteesTileY = useCallback(
    (memberId: string): number =>
      inviteesRowY + laneOffset(inviteesRowLanes.get(memberId) ?? 0, BASE_TILE),
    [inviteesRowY, inviteesRowLanes],
  );

  const canOpenMate = useCallback(
    (memberId: string) => membersById.get(memberId)?.inviter_id != null,
    [membersById],
  );

  // Branch tile Y helpers. `matesBaseCeiling` = the highest (smallest y)
  // point any base-row mate tile reaches given its sub-lane. Branch
  // layers stack above that ceiling so they never overlap base tiles.
  const matesBaseCeiling = useMemo(
    () => matesRowY - laneOffset(branchExtents.maxMatesLane, BASE_TILE),
    [matesRowY, branchExtents.maxMatesLane],
  );
  const inviteesBaseFloor = useMemo(
    () => inviteesRowY + laneOffset(branchExtents.maxInviteesLane, BASE_TILE),
    [inviteesRowY, branchExtents.maxInviteesLane],
  );

  const upBranchTileY = useCallback(
    (memberId: string, layer: number): number =>
      matesBaseCeiling -
      layer * BRANCH_PITCH -
      laneOffset(upwardBranches.laneByTile.get(memberId) ?? 0, BRANCH_TILE),
    [matesBaseCeiling, upwardBranches.laneByTile],
  );
  const downBranchTileY = useCallback(
    (memberId: string, depth: number): number =>
      inviteesBaseFloor +
      depth * BRANCH_PITCH +
      laneOffset(downwardBranches.laneByTile.get(memberId) ?? 0, BRANCH_TILE),
    [inviteesBaseFloor, downwardBranches.laneByTile],
  );

  const invitedCountFor = useCallback(
    (memberId: string) =>
      data.members.filter((m) => m.inviter_id === memberId).length,
    [data.members],
  );

  // ── Lineage trace ──────────────────────────────────────────────
  // Hover any tile → every node + link on the paths through that
  // member lights up, everything else drops back. Above the line the
  // trace covers every chain containing the hovered member; below,
  // it covers the path back to the subject plus everything visible
  // beneath. Base tiles that aren't part of any open chain still
  // trivially "contain" themselves so they light in isolation.
  const hoveredId = hoveredMember?.member.id ?? null;

  // Auto-scroll the timeline to today whenever the subject changes,
  // so the most recent (rightmost) portion is visible by default and
  // older history is one scroll-back away rather than being what the
  // viewer lands on. Runs after paint so scrollWidth is settled.
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;
    s.scrollLeft = s.scrollWidth;
  }, [subjectId]);

  // On tooltip mount (hoveredMember flip null → set), place the
  // tooltip at the last known mouse position before paint so it
  // never flashes at (0,0). Subsequent mousemoves keep it tracking
  // via the ref.
  useEffect(() => {
    if (!hoveredMember) return;
    const el = tooltipRef.current;
    if (!el) return;
    el.style.left = `${lastMousePos.current.x + 14}px`;
    el.style.top = `${lastMousePos.current.y + 16}px`;
  }, [hoveredMember]);

  const litIds = useMemo((): Set<string> | null => {
    if (!hoveredId || !subject) return null;

    const upVisible = new Set<string>(upwardBranches.nodes.keys());
    matesTiles.forEach((tile) => upVisible.add(tile.member.id));
    if (inviter) upVisible.add(inviter.id);

    const downVisible = new Set<string>(downwardBranches.nodes.keys());

    const isMatesSide = upVisible.has(hoveredId);
    const lit = new Set<string>([hoveredId]);

    if (isMatesSide) {
      // Walk up: each ancestor of hoveredId that is currently visible
      // stays in the lit set. Terminate at the first not-in-view.
      let cursor: TimelineMember | undefined = membersById.get(hoveredId);
      while (cursor?.inviter_id && upVisible.has(cursor.inviter_id)) {
        lit.add(cursor.inviter_id);
        cursor = membersById.get(cursor.inviter_id);
      }
      // Walk down: any visible member whose inviter chain passes
      // through hoveredId (BFS via reverse-inviter, staying inside
      // upVisible). Handles the "shared ancestor lights every mate
      // that descends from them" case in the brief.
      const stack: string[] = [hoveredId];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) break;
        data.members.forEach((m) => {
          if (m.inviter_id !== cur) return;
          if (!upVisible.has(m.id)) return;
          if (lit.has(m.id)) return;
          lit.add(m.id);
          stack.push(m.id);
        });
      }
    } else if (downVisible.has(hoveredId)) {
      // Path back to the subject always lights.
      lit.add(subject.id);
      let cursor: TimelineMember | undefined = membersById.get(hoveredId);
      while (cursor?.inviter_id) {
        const pid = cursor.inviter_id;
        if (pid === subject.id) break;
        if (!downVisible.has(pid)) break;
        lit.add(pid);
        cursor = membersById.get(pid);
      }
      // Everything visible beneath (down via reverse-inviter, staying
      // in downVisible).
      const stack: string[] = [hoveredId];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) break;
        data.members.forEach((m) => {
          if (m.inviter_id !== cur) return;
          if (!downVisible.has(m.id)) return;
          if (lit.has(m.id)) return;
          lit.add(m.id);
          stack.push(m.id);
        });
      }
    }
    return lit;
  }, [
    hoveredId,
    subject,
    upwardBranches.nodes,
    downwardBranches.nodes,
    matesTiles,
    inviter,
    membersById,
    data.members,
  ]);

  const isLit = useCallback(
    (id: string): boolean => {
      if (!litIds) return true;
      return litIds.has(id);
    },
    [litIds],
  );

  const isLinkLit = useCallback(
    (childId: string, parentId: string): boolean => {
      if (!litIds) return true;
      return litIds.has(childId) && litIds.has(parentId);
    },
    [litIds],
  );

  // Also light the subject-to-inviter link when either endpoint is lit.
  const isSubjectInviterLinkLit = useCallback((): boolean => {
    if (!litIds) return true;
    if (!subject || !inviter) return false;
    return litIds.has(subject.id) || litIds.has(inviter.id);
  }, [litIds, subject, inviter]);

  if (!subject) {
    return (
      <div className='mates-tab__empty'>
        <FormattedMessage
          id='mates_tab.empty'
          defaultMessage='No timeline data available for this member.'
        />
      </div>
    );
  }

  const subjectJoinDay = dayIndex(subject.joined_at, data.anchor_date);
  const subjectJoinX = xForDay(subjectJoinDay);
  const trackEndX = xForDay(todayDay);
  const inviterJoinX = inviter
    ? xForDay(dayIndex(inviter.joined_at, data.anchor_date))
    : null;

  // Reference marker: the viewer's own join date on the axis, drawn
  // as a fixed cross-bar so it stays legible when the subject changes.
  const viewerJoinX = viewerMember
    ? xForDay(dayIndex(viewerMember.joined_at, data.anchor_date))
    : null;

  return (
    <div className='mates-tab__layout'>
      <div className='mates-tab__canvas'>
        {trail.length > 1 && (
          <nav className='mates-tab__trail' aria-label='Subject trail'>
            <span className='mates-tab__trail-label'>
              <FormattedMessage
                id='mates_tab.trail.label'
                defaultMessage='Path'
              />
            </span>
            {trail.map((id, idx) => {
              const member = membersById.get(id);
              if (!member) return null;
              const isCurrent = idx === trail.length - 1;
              return (
                <TrailEntry
                  key={`trail-${idx.toString()}-${id}`}
                  idx={idx}
                  handle={member.handle}
                  isCurrent={isCurrent}
                  onSelect={onTrailClick}
                />
              );
            })}
            <span className='mates-tab__trail-hint'>
              <FormattedMessage
                id='mates_tab.trail.escape_hint'
                defaultMessage='esc → my line'
              />
            </span>
          </nav>
        )}
        <div className='mates-tab__subject-bar'>
          <span className='mates-tab__subject-eyebrow'>
            <FormattedMessage id='mates_tab.subject' defaultMessage='Subject' />
          </span>
          <span className='mates-tab__subject-name'>
            {subject.display_name}
          </span>
          <span className='mates-tab__subject-handle'>@{subject.handle}</span>
          {subject.id !== (viewerMember?.id ?? '') && viewerMember && (
            <ResetButton onSelect={onTileClick} viewerId={viewerMember.id} />
          )}
        </div>

        <div className='mates-tab__scroller' ref={scrollerRef}>
          <svg
            className={`mates-tab__svg${litIds ? ' mates-tab__svg--hovered' : ''}`}
            width={svgWidth}
            height={svgHeight + topPad + bottomPad}
            viewBox={`0 ${-topPad} ${svgWidth} ${svgHeight + topPad + bottomPad}`}
            role='img'
            aria-label='Mates timeline'
          >
            {/* axis quarter marks */}
            {Array.from(
              { length: Math.floor(todayDay / AXIS_MARK_INTERVAL_DAYS) + 1 },
              (_, i) => {
                const day = i * AXIS_MARK_INTERVAL_DAYS;
                if (day > todayDay) return null;
                const x = xForDay(day);
                const iso = new Date(
                  new Date(data.anchor_date).getTime() + day * 86_400_000,
                ).toISOString();
                return (
                  <g key={day} className='mates-tab__axis-mark'>
                    <line
                      x1={x}
                      x2={x}
                      y1={lineY - TRACK_HEIGHT / 2 - 4}
                      y2={lineY + TRACK_HEIGHT / 2 + 4}
                    />
                    <text
                      x={x}
                      y={svgHeight - 8}
                      textAnchor='middle'
                      className='mates-tab__axis-label'
                    >
                      {new Date(iso).toLocaleDateString(undefined, {
                        year: '2-digit',
                        month: 'short',
                      })}
                    </text>
                  </g>
                );
              },
            )}

            {/* Viewer's join-date reference (only when subject != viewer) */}
            {viewerJoinX !== null && subject.id !== viewerMember?.id && (
              <g className='mates-tab__viewer-marker'>
                <line x1={viewerJoinX} x2={viewerJoinX} y1={0} y2={svgHeight} />
                <text
                  x={viewerJoinX + 4}
                  y={12}
                  className='mates-tab__viewer-marker-label'
                >
                  <FormattedMessage
                    id='mates_tab.viewer_joined'
                    defaultMessage='You joined'
                  />
                </text>
              </g>
            )}

            {/* Inviter link — cubic bezier from the head cap up to the inviter tile.
                Per brief: the inviter sits above the line at their own join date,
                linked to the head of the subject's line. */}
            {inviter && inviterJoinX !== null && (
              <path
                d={`M ${subjectJoinX} ${lineY - TRACK_HEIGHT / 2} C ${subjectJoinX} ${(matesTileY(inviter.id) + lineY) / 2}, ${inviterJoinX} ${(matesTileY(inviter.id) + lineY) / 2}, ${inviterJoinX} ${matesTileY(inviter.id) + BASE_TILE / 2}`}
                className={`mates-tab__inviter-link${isSubjectInviterLinkLit() ? ' mates-tab__inviter-link--lit' : ''}`}
              />
            )}

            {/* Subject's main track — rounded rectangle from join to today */}
            <rect
              x={subjectJoinX}
              y={lineY - TRACK_HEIGHT / 2}
              width={Math.max(1, trackEndX - subjectJoinX)}
              height={TRACK_HEIGHT}
              rx={TRACK_HEIGHT / 2}
              ry={TRACK_HEIGHT / 2}
              className='mates-tab__track'
            />

            {/* Dots on the line at every mate bond date (the branch points) */}
            {matesTiles.map((tile) => (
              <circle
                key={`dot-${tile.member.id}`}
                cx={tile.x}
                cy={lineY}
                r={4}
                className={`mates-tab__branch-dot${isLit(tile.member.id) ? ' mates-tab__branch-dot--lit' : ''}`}
              />
            ))}
            {inviteesTiles.map((tile) => (
              <circle
                key={`dot-inv-${tile.member.id}`}
                cx={tile.x}
                cy={lineY}
                r={4}
                className={`mates-tab__branch-dot${isLit(tile.member.id) ? ' mates-tab__branch-dot--lit' : ''}`}
              />
            ))}

            {/* Head tile — the subject themselves, sitting on their join date */}
            <g
              className='mates-tab__head'
              transform={`translate(${subjectJoinX}, ${lineY})`}
              tabIndex={0}
              role='button'
              aria-label={`Subject: ${subject.display_name}`}
            >
              <circle r={HEAD_TILE / 2} className='mates-tab__head-circle' />
              <text
                y={HEAD_TILE / 2 + 16}
                textAnchor='middle'
                className='mates-tab__head-label'
              >
                @{subject.handle}
              </text>
            </g>

            {/* Inviter tile — smaller circle at the head of the invite chain */}
            {inviter && inviterJoinX !== null && (
              <TimelineTile
                key={`inviter-${inviter.id}`}
                x={inviterJoinX}
                y={matesTileY(inviter.id)}
                size={BASE_TILE}
                member={inviter}
                label={inviter.handle}
                detail={`invited ${subject.display_name} · joined ${formatShort(inviter.joined_at)}`}
                onClick={onTileClick}
                onHoverEnter={onTileHoverEnter}
                onHoverMove={onTileHoverMove}
                variant='inviter'
                lit={isLit(inviter.id)}
                pip={
                  canOpenMate(inviter.id)
                    ? {
                        key: `a/${inviter.id}`,
                        side: 'up',
                        open: openedKeys.has(`a/${inviter.id}`),
                        glyph: '↑',
                        onToggle: togglePip,
                      }
                    : undefined
                }
              />
            )}

            {/* Vertical thin link line + tile for each mate above the line */}
            {matesTiles.map((tile) => (
              <g key={`mate-${tile.member.id}`}>
                <line
                  x1={tile.x}
                  x2={tile.x}
                  y1={lineY - TRACK_HEIGHT / 2}
                  y2={matesTileY(tile.member.id) + BASE_TILE / 2}
                  className={`mates-tab__link${isLit(tile.member.id) ? ' mates-tab__link--lit' : ''}`}
                />
                <TimelineTile
                  x={tile.x}
                  y={matesTileY(tile.member.id)}
                  size={BASE_TILE}
                  member={tile.member}
                  label={tile.label}
                  detail={tile.detail}
                  onClick={onTileClick}
                  onHoverEnter={onTileHoverEnter}
                  onHoverMove={onTileHoverMove}
                  variant='mate'
                  lit={isLit(tile.member.id)}
                  pip={
                    canOpenMate(tile.member.id)
                      ? {
                          key: `a/${tile.member.id}`,
                          side: 'up',
                          open: openedKeys.has(`a/${tile.member.id}`),
                          glyph: '↑',
                          onToggle: togglePip,
                        }
                      : undefined
                  }
                />
              </g>
            ))}

            {/* Vertical thin link line + tile for each invitee below the line */}
            {inviteesTiles.map((tile) => {
              const count = invitedCountFor(tile.member.id);
              return (
                <g key={`inv-${tile.member.id}`}>
                  <line
                    x1={tile.x}
                    x2={tile.x}
                    y1={lineY + TRACK_HEIGHT / 2}
                    y2={inviteesTileY(tile.member.id) - BASE_TILE / 2}
                    className={`mates-tab__link${isLit(tile.member.id) ? ' mates-tab__link--lit' : ''}`}
                  />
                  <TimelineTile
                    x={tile.x}
                    y={inviteesTileY(tile.member.id)}
                    size={BASE_TILE}
                    member={tile.member}
                    label={tile.label}
                    detail={tile.detail}
                    onClick={onTileClick}
                    onHoverEnter={onTileHoverEnter}
                    onHoverMove={onTileHoverMove}
                    variant='invitee'
                    lit={isLit(tile.member.id)}
                    pip={
                      count > 0
                        ? {
                            key: `b/${tile.member.id}`,
                            side: 'down',
                            open: openedKeys.has(`b/${tile.member.id}`),
                            glyph: String(count),
                            onToggle: togglePip,
                          }
                        : undefined
                    }
                  />
                </g>
              );
            })}

            {/* Upward branch links — cubic beziers between visible ancestors and their in-view children */}
            {upwardBranches.links.map((edge) => {
              const child = upwardBranches.nodes.get(edge.childId);
              const parent = upwardBranches.nodes.get(edge.parentId);
              if (!child || !parent) return null;
              const childLayer = upwardBranches.layer.get(edge.childId) ?? 0;
              const parentLayer = upwardBranches.layer.get(edge.parentId) ?? 0;
              const cx = xForDay(child.day);
              const cy = child.base
                ? matesTileY(edge.childId) - BASE_TILE / 2
                : upBranchTileY(edge.childId, childLayer) + BRANCH_TILE / 2;
              const px = xForDay(parent.day);
              const py =
                upBranchTileY(edge.parentId, parentLayer) + BRANCH_TILE / 2;
              const midY = (cy + py) / 2;
              return (
                <path
                  key={`up-link-${edge.childId}-${edge.parentId}`}
                  d={`M ${cx} ${cy} C ${cx} ${midY}, ${px} ${midY}, ${px} ${py}`}
                  className={`mates-tab__branch-link${isLinkLit(edge.childId, edge.parentId) ? ' mates-tab__branch-link--lit' : ''}`}
                />
              );
            })}

            {/* Upward branch tiles — the opened ancestors */}
            {Array.from(upwardBranches.nodes.values())
              .filter((n) => !n.base)
              .map((node) => {
                const member = membersById.get(node.id);
                if (!member) return null;
                const layer = upwardBranches.layer.get(node.id) ?? 0;
                return (
                  <TimelineTile
                    key={`up-node-${node.id}`}
                    x={xForDay(node.day)}
                    y={upBranchTileY(node.id, layer)}
                    size={BRANCH_TILE}
                    member={member}
                    label={member.handle}
                    detail={`joined ${formatShort(member.joined_at)}`}
                    onClick={onTileClick}
                    onHoverEnter={onTileHoverEnter}
                    onHoverMove={onTileHoverMove}
                    variant='branch-up'
                    showLabel={false}
                    lit={isLit(node.id)}
                  />
                );
              })}

            {/* Downward branch links — parent above, child below */}
            {downwardBranches.links.map((edge) => {
              const child = downwardBranches.nodes.get(edge.childId);
              const parent = downwardBranches.nodes.get(edge.parentId);
              if (!child || !parent) return null;
              const cx = xForDay(child.day);
              const cy =
                downBranchTileY(edge.childId, child.depth) - BRANCH_TILE / 2;
              const px = xForDay(parent.day);
              const py = parent.base
                ? inviteesTileY(edge.parentId) + BASE_TILE / 2
                : downBranchTileY(edge.parentId, parent.depth) -
                  BRANCH_TILE / 2;
              const midY = (cy + py) / 2;
              return (
                <path
                  key={`down-link-${edge.childId}-${edge.parentId}`}
                  d={`M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`}
                  className={`mates-tab__branch-link${isLinkLit(edge.childId, edge.parentId) ? ' mates-tab__branch-link--lit' : ''}`}
                />
              );
            })}

            {/* Downward branch tiles — the opened invitees' descendants */}
            {Array.from(downwardBranches.nodes.values())
              .filter((n) => !n.base)
              .map((node) => {
                const member = membersById.get(node.id);
                if (!member) return null;
                const count = invitedCountFor(node.id);
                return (
                  <TimelineTile
                    key={`down-node-${node.id}`}
                    x={xForDay(node.day)}
                    y={downBranchTileY(node.id, node.depth)}
                    size={BRANCH_TILE}
                    member={member}
                    label={member.handle}
                    detail={`joined ${formatShort(member.joined_at)}`}
                    onClick={onTileClick}
                    onHoverEnter={onTileHoverEnter}
                    onHoverMove={onTileHoverMove}
                    variant='branch-down'
                    showLabel={false}
                    lit={isLit(node.id)}
                    pip={
                      count > 0
                        ? {
                            key: `b/${node.id}`,
                            side: 'down',
                            open: openedKeys.has(`b/${node.id}`),
                            glyph: String(count),
                            onToggle: togglePip,
                          }
                        : undefined
                    }
                  />
                );
              })}
          </svg>
        </div>

        {hoveredMember && (
          <div className='mates-tab__tooltip' ref={tooltipRef} role='tooltip'>
            <div className='mates-tab__tooltip-name'>
              {hoveredMember.member.display_name}
              <span className='mates-tab__tooltip-handle'>
                @{hoveredMember.member.handle}
              </span>
            </div>
            {hoveredMember.detail && (
              <div className='mates-tab__tooltip-detail'>
                {hoveredMember.detail}
              </div>
            )}
            <div className='mates-tab__tooltip-hint'>
              <FormattedMessage
                id='mates_tab.click_to_focus'
                defaultMessage='Click to switch to this member'
              />
            </div>
          </div>
        )}

        <DetailPanel
          subject={subject}
          viewer={viewerMember ?? null}
          mates={matesTiles}
          invitees={inviteesTiles}
          inviter={inviter}
        />
      </div>

      <ContactsRail
        subject={subject}
        mates={matesTiles}
        invitees={inviteesTiles}
        allMembers={data.members}
        onSelect={onTileClick}
      />
    </div>
  );
};

// ── Trail entry ────────────────────────────────────────────────────
const TrailEntry = ({
  idx,
  handle,
  isCurrent,
  onSelect,
}: {
  idx: number;
  handle: string;
  isCurrent: boolean;
  onSelect: (idx: number) => void;
}) => {
  const handleClick = useCallback(() => {
    if (!isCurrent) onSelect(idx);
  }, [idx, isCurrent, onSelect]);
  return (
    <button
      type='button'
      className={`mates-tab__trail-entry${isCurrent ? ' mates-tab__trail-entry--current' : ''}`}
      onClick={handleClick}
      disabled={isCurrent}
      aria-current={isCurrent ? 'true' : undefined}
    >
      @{handle}
    </button>
  );
};

// ── Reset button ───────────────────────────────────────────────────
const ResetButton = ({
  onSelect,
  viewerId,
}: {
  onSelect: (id: string) => void;
  viewerId: string;
}) => {
  const handleClick = useCallback(() => {
    onSelect(viewerId);
  }, [onSelect, viewerId]);
  return (
    <button type='button' className='mates-tab__reset' onClick={handleClick}>
      <FormattedMessage
        id='mates_tab.reset'
        defaultMessage='Return to my line'
      />
    </button>
  );
};

// ── Tile subcomponent ──────────────────────────────────────────────
interface TimelineTileProps {
  x: number;
  y: number;
  size: number;
  member: TimelineMember;
  label: string;
  detail?: string;
  variant: 'mate' | 'invitee' | 'inviter' | 'branch-up' | 'branch-down';
  onClick: (id: string) => void;
  onHoverEnter: (info: HoverMember | null) => void;
  onHoverMove: (clientX: number, clientY: number) => void;
  showLabel?: boolean;
  lit?: boolean; // true when this tile is part of the lineage trace path
  pip?: {
    key: string;
    side: 'up' | 'down';
    open: boolean;
    glyph: string; // '↑' for upward chain, invitee-count for downward
    onToggle: (key: string) => void;
  };
}

const TimelineTile: React.FC<TimelineTileProps> = ({
  x,
  y,
  size,
  member,
  label,
  detail,
  variant,
  onClick,
  onHoverEnter,
  onHoverMove,
  showLabel = true,
  lit,
  pip,
}) => {
  const handleClick = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      // Pip clicks are handled by the pip's own handler; the outer
      // <g> also receives the event but we let it through only for
      // the tile-body itself.
      const target = event.target as Element;
      if (target.classList.contains('mates-tab__pip')) return;
      if (target.classList.contains('mates-tab__pip-glyph')) return;
      onClick(member.id);
    },
    [member.id, onClick],
  );

  const handleEnter = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      onHoverEnter({ member, detail });
      onHoverMove(event.clientX, event.clientY);
    },
    [detail, member, onHoverEnter, onHoverMove],
  );

  const handleMove = useCallback(
    (event: React.MouseEvent<SVGGElement>) => {
      // No state update — tooltip position is written directly to
      // the tooltip DOM via a ref by the parent. This keeps mouse
      // moves from re-rendering the whole SVG.
      onHoverMove(event.clientX, event.clientY);
    },
    [onHoverMove],
  );

  const handleLeave = useCallback(() => {
    onHoverEnter(null);
  }, [onHoverEnter]);

  const handlePipClick = useCallback(
    (event: React.MouseEvent<SVGCircleElement | SVGTextElement>) => {
      event.stopPropagation();
      if (pip) pip.onToggle(pip.key);
    },
    [pip],
  );

  // Pip sits on the outer edge of the tile (further from the line).
  // For upward tiles the pip is above; for downward tiles below.
  const pipOffset = pip
    ? pip.side === 'up'
      ? -(size / 2 + PIP_RADIUS - 1)
      : size / 2 + PIP_RADIUS - 1
    : 0;

  return (
    <g
      className={`mates-tab__tile mates-tab__tile--${variant}${pip?.open ? ' mates-tab__tile--open' : ''}${lit ? ' mates-tab__tile--lit' : ''}`}
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      tabIndex={0}
      role='button'
      aria-label={`${member.display_name} (@${member.handle})`}
    >
      <circle r={size / 2} className='mates-tab__tile-shape' />
      {showLabel && (
        <text
          y={size / 2 + 14}
          textAnchor='middle'
          className='mates-tab__tile-label'
        >
          @{label}
        </text>
      )}
      {pip && (
        <g className='mates-tab__pip-wrap'>
          <circle
            cx={0}
            cy={pipOffset}
            r={PIP_RADIUS}
            className={`mates-tab__pip${pip.open ? ' mates-tab__pip--open' : ''}`}
            onClick={handlePipClick}
            aria-label={
              pip.side === 'up'
                ? 'Open invite chain'
                : `Open who they invited (${pip.glyph})`
            }
          />
          <text
            x={0}
            y={pipOffset}
            className='mates-tab__pip-glyph'
            onClick={handlePipClick}
          >
            {pip.glyph}
          </text>
        </g>
      )}
    </g>
  );
};
