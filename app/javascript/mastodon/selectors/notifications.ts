import { createSelector } from '@reduxjs/toolkit';

import { compareId } from 'mastodon/compare_id';
import type { NotificationGroup } from 'mastodon/models/notification_group';
import type { NotificationGap } from 'mastodon/reducers/notification_groups';
import type { RootState } from 'mastodon/store';

import {
  selectSettingsNotificationsExcludedTypes,
  selectSettingsNotificationsQuickFilterActive,
  selectSettingsNotificationsQuickFilterShow,
} from './settings';

// Nudge notifications belong exclusively in the /nudges tab.
// Strip them from the main notifications view at all times.
const NUDGES_ONLY_TYPES = ['nudge'];

const filterNotificationsByAllowedTypes = (
  showFilterBar: boolean,
  allowedType: string,
  excludedTypes: string[],
  notifications: (NotificationGroup | NotificationGap)[],
) => {
  if (!showFilterBar || allowedType === 'all') {
    // used if user changed the notification settings after loading the notifications from the server
    // otherwise a list of notifications will come pre-filtered from the backend
    // we need to turn it off for FilterBar in order not to block ourselves from seeing a specific category
    return notifications.filter(
      (item) =>
        item.type === 'gap' ||
        (!excludedTypes.includes(item.type) &&
          !NUDGES_ONLY_TYPES.includes(item.type)),
    );
  }
  return notifications.filter(
    (item) =>
      item.type === 'gap' ||
      (allowedType === item.type && !NUDGES_ONLY_TYPES.includes(item.type)) ||
      (allowedType === 'mention' && item.type === 'quote'),
  );
};

export const selectNotificationGroups = createSelector(
  [
    selectSettingsNotificationsQuickFilterShow,
    selectSettingsNotificationsQuickFilterActive,
    selectSettingsNotificationsExcludedTypes,
    (state: RootState) => state.notificationGroups.groups,
  ],
  filterNotificationsByAllowedTypes,
);

const selectPendingNotificationGroups = createSelector(
  [
    selectSettingsNotificationsQuickFilterShow,
    selectSettingsNotificationsQuickFilterActive,
    selectSettingsNotificationsExcludedTypes,
    (state: RootState) => state.notificationGroups.pendingGroups,
  ],
  filterNotificationsByAllowedTypes,
);

export const selectUnreadNotificationGroupsCount = createSelector(
  [
    (s: RootState) => s.notificationGroups.lastReadId,
    selectNotificationGroups,
    selectPendingNotificationGroups,
  ],
  (notificationMarker, groups, pendingGroups) => {
    return (
      groups.filter(
        (group) =>
          group.type !== 'gap' &&
          group.page_max_id &&
          compareId(group.page_max_id, notificationMarker) > 0,
      ).length +
      pendingGroups.filter(
        (group) =>
          group.type !== 'gap' &&
          group.page_max_id &&
          compareId(group.page_max_id, notificationMarker) > 0,
      ).length
    );
  },
);

// Whether there is any unread notification according to the user-facing state
export const selectAnyPendingNotification = createSelector(
  [
    (s: RootState) => s.notificationGroups.readMarkerId,
    selectNotificationGroups,
  ],
  (notificationMarker, groups) => {
    return groups.some(
      (group) =>
        group.type !== 'gap' &&
        group.page_max_id &&
        compareId(group.page_max_id, notificationMarker) > 0,
    );
  },
);

export const selectUnreadNudgesCount = (state: RootState) =>
  state.notificationGroups.unreadNudgeCount;

// ── Waving-hand alert signal ─────────────────────────────────────────
// Korner/system notification types delivered by the Kronk system nudger.
// Maps each to the korner it belongs to so a Hub tile can light up.
// Extensible: add new korner-native notification types here.
export const KORNER_SYSTEM_TYPE_TO_SLUG: Record<string, string> = {
  proposal_status_changed: 'kommons',
  proposal_challenged: 'kommons',
  task_assigned: 'kommons',
};

const selectRawGroups = (s: RootState) => s.notificationGroups.groups;
const selectRawPendingGroups = (s: RootState) =>
  s.notificationGroups.pendingGroups;
const selectReadMarkerId = (s: RootState) => s.notificationGroups.readMarkerId;

const isGroupUnread = (
  group: NotificationGroup | NotificationGap,
  marker: string,
): group is NotificationGroup =>
  group.type !== 'gap' &&
  !!group.page_max_id &&
  compareId(group.page_max_id, marker) > 0;

// Any unread Mate nudge OR any unread korner/system notification.
export const selectHasUnreadNudges = createSelector(
  [
    selectUnreadNudgesCount,
    selectReadMarkerId,
    selectRawGroups,
    selectRawPendingGroups,
  ],
  (nudgeCount, marker, groups, pendingGroups) => {
    if (nudgeCount > 0) return true;
    return [...groups, ...pendingGroups].some(
      (group) =>
        KORNER_SYSTEM_TYPE_TO_SLUG[group.type] !== undefined &&
        isGroupUnread(group, marker),
    );
  },
);

// The newest nudge/korner-system notification, for the arrival toast.
// `proposalTitle` is set for proposal notifications so the toast can name it.
export interface LatestAlertNotification {
  id: string;
  proposalTitle: string | null;
}

export const selectLatestAlertNotification = createSelector(
  [selectRawGroups, selectRawPendingGroups],
  (groups, pendingGroups): LatestAlertNotification | null => {
    let best: LatestAlertNotification | null = null;
    let bestId: string | null = null;
    for (const group of [...groups, ...pendingGroups]) {
      if (group.type === 'gap') continue;
      const relevant =
        group.type === 'nudge' ||
        KORNER_SYSTEM_TYPE_TO_SLUG[group.type] !== undefined;
      if (!relevant) continue;
      const id = group.page_max_id;
      if (!id) continue;
      if (bestId === null || compareId(id, bestId) > 0) {
        bestId = id;
        best = {
          id,
          proposalTitle:
            group.type === 'proposal_status_changed'
              ? (group.proposal?.proposal_title ?? null)
              : null,
        };
      }
    }
    return best;
  },
);

// Proposal ids carried by unread proposal notifications (Kommons cards).
export const selectUnreadProposalIds = createSelector(
  [selectReadMarkerId, selectRawGroups, selectRawPendingGroups],
  (marker, groups, pendingGroups) => {
    const ids = new Set<string>();
    for (const group of [...groups, ...pendingGroups]) {
      if (group.type !== 'proposal_status_changed') continue;
      if (!isGroupUnread(group, marker)) continue;
      const proposalId = group.proposal?.proposal_id;
      if (proposalId) ids.add(proposalId);
    }
    return ids;
  },
);

export const selectPendingNotificationGroupsCount = createSelector(
  [selectPendingNotificationGroups],
  (pendingGroups) =>
    pendingGroups.filter((group) => group.type !== 'gap').length,
);
