import type {
  ApiAccountRelationshipSeveranceEventJSON,
  ApiAccountWarningJSON,
  ApiAnnualReportEventJSON,
  BaseNotificationGroupJSON,
  ApiNotificationGroupJSON,
  ApiNotificationJSON,
  ApiEventInvitationJSON,
  ApiProposalCompleteJSON,
  ApiTaskAssignedJSON,
  NotificationType,
  NotificationWithStatusType,
} from 'mastodon/api_types/notifications';
import type { ApiReportJSON } from 'mastodon/api_types/reports';

// Maximum number of avatars displayed in a notification group
// This corresponds to the max lenght of `group.sampleAccountIds`
export const NOTIFICATIONS_GROUP_MAX_AVATARS = 8;

interface BaseNotificationGroup
  extends Omit<BaseNotificationGroupJSON, 'sample_account_ids'> {
  sampleAccountIds: string[];
  partial: boolean;
}

interface BaseNotificationWithStatus<Type extends NotificationWithStatusType>
  extends BaseNotificationGroup {
  type: Type;
  statusId: string | undefined;
}

interface BaseNotification<Type extends NotificationType>
  extends BaseNotificationGroup {
  type: Type;
}

export type NotificationGroupFavourite =
  BaseNotificationWithStatus<'favourite'>;
export type NotificationGroupReblog = BaseNotificationWithStatus<'reblog'>;
export type NotificationGroupStatus = BaseNotificationWithStatus<'status'>;
export type NotificationGroupMention = BaseNotificationWithStatus<'mention'>;
export type NotificationGroupQuote = BaseNotificationWithStatus<'quote'>;
export type NotificationGroupPoll = BaseNotificationWithStatus<'poll'>;
export type NotificationGroupUpdate = BaseNotificationWithStatus<'update'>;
export type NotificationGroupQuotedUpdate =
  BaseNotificationWithStatus<'quoted_update'>;
export type NotificationGroupFollow = BaseNotification<'follow'>;
export type NotificationGroupFollowRequest = BaseNotification<'follow_request'>;
export type NotificationGroupAdminSignUp = BaseNotification<'admin.sign_up'>;
export type NotificationGroupInviteAccepted =
  BaseNotification<'invite_accepted'>;

type EventInvitationData = ApiEventInvitationJSON;
export interface NotificationGroupEventInvitation
  extends BaseNotification<'event_invitation'> {
  eventInvitation: EventInvitationData | null;
}

type ProposalCompleteData = ApiProposalCompleteJSON;
export interface NotificationGroupProposalComplete
  extends BaseNotification<'proposal_status_changed'> {
  proposal: ProposalCompleteData | null;
}

// A block vote challenging a proposal you authored. Same payload as
// proposal_status_changed; separate type so the pane can word it differently.
export interface NotificationGroupProposalChallenged
  extends BaseNotification<'proposal_challenged'> {
  proposal: ProposalCompleteData | null;
}

// A task on a proposal assigned to you. Links to the parent proposal — tasks
// have no route of their own.
export interface NotificationGroupTaskAssigned
  extends BaseNotification<'task_assigned'> {
  task: ApiTaskAssignedJSON | null;
}

// Kronk-native self-notice — surfaces in the Kronk system pane of the
// Nudges messenger. Fired at signup + weekly thereafter while the
// account is unconfirmed. The email string is what the reminder asks
// you to confirm (falls back to primary email when there's no pending
// reconfirmation).
export interface NotificationGroupEmailConfirmationReminder
  extends BaseNotification<'email_confirmation_reminder'> {
  emailConfirmationEmail: string | null;
}

export type NudgeReactionEmoji = '❤️' | '😂' | '🙌' | '🔥' | '😢';
export type NudgeReactions = Record<
  NudgeReactionEmoji,
  { count: number; me: boolean }
>;

export interface NudgeMessageData {
  body: string | null;
  mediaUrl: string | null;
  voiceUrl: string | null;
  inReplyTo: { body: string | null; mediaUrl: string | null } | null;
}

export interface NotificationGroupNudge extends BaseNotification<'nudge'> {
  nudgeStreak: number;
  nudgeMessage?: NudgeMessageData;
  nudgeReactions: NudgeReactions;
}

export interface NotificationGroupMediaTag
  extends BaseNotification<'media_tag'> {
  mediaTagPreviewUrl: string | null;
  mediaTagStatusPath: string | null;
}

export type AccountWarningAction =
  | 'none'
  | 'disable'
  | 'mark_statuses_as_sensitive'
  | 'delete_statuses'
  | 'sensitive'
  | 'silence'
  | 'suspend';
export interface AccountWarning
  extends Omit<ApiAccountWarningJSON, 'target_account'> {
  targetAccountId: string;
}

export interface NotificationGroupModerationWarning
  extends BaseNotification<'moderation_warning'> {
  moderationWarning: AccountWarning;
}

type AccountRelationshipSeveranceEvent =
  ApiAccountRelationshipSeveranceEventJSON;
export interface NotificationGroupSeveredRelationships
  extends BaseNotification<'severed_relationships'> {
  event: AccountRelationshipSeveranceEvent;
}

type AnnualReportEvent = ApiAnnualReportEventJSON;
export interface NotificationGroupAnnualReport
  extends BaseNotification<'annual_report'> {
  annualReport: AnnualReportEvent;
}

interface Report extends Omit<ApiReportJSON, 'target_account'> {
  targetAccountId: string;
}

export interface NotificationGroupAdminReport
  extends BaseNotification<'admin.report'> {
  report: Report;
}

export type NotificationGroup =
  | NotificationGroupFavourite
  | NotificationGroupReblog
  | NotificationGroupStatus
  | NotificationGroupMention
  | NotificationGroupQuote
  | NotificationGroupPoll
  | NotificationGroupUpdate
  | NotificationGroupQuotedUpdate
  | NotificationGroupFollow
  | NotificationGroupFollowRequest
  | NotificationGroupModerationWarning
  | NotificationGroupSeveredRelationships
  | NotificationGroupAdminSignUp
  | NotificationGroupAdminReport
  | NotificationGroupAnnualReport
  | NotificationGroupEventInvitation
  | NotificationGroupNudge
  | NotificationGroupMediaTag
  | NotificationGroupProposalComplete
  | NotificationGroupProposalChallenged
  | NotificationGroupTaskAssigned
  | NotificationGroupEmailConfirmationReminder
  | NotificationGroupInviteAccepted;

function createReportFromJSON(reportJSON: ApiReportJSON): Report {
  const { target_account, ...report } = reportJSON;
  return {
    targetAccountId: target_account.id,
    ...report,
  };
}

function createAccountWarningFromJSON(
  warningJSON: ApiAccountWarningJSON,
): AccountWarning {
  const { target_account, ...warning } = warningJSON;
  return {
    targetAccountId: target_account.id,
    ...warning,
  };
}

function createAccountRelationshipSeveranceEventFromJSON(
  eventJson: ApiAccountRelationshipSeveranceEventJSON,
): AccountRelationshipSeveranceEvent {
  return eventJson;
}

function createAnnualReportEventFromJSON(
  eventJson: ApiAnnualReportEventJSON,
): AnnualReportEvent {
  return eventJson;
}

export function createNotificationGroupFromJSON(
  groupJson: ApiNotificationGroupJSON,
): NotificationGroup {
  const { sample_account_ids: sampleAccountIds, ...group } = groupJson;

  switch (group.type) {
    case 'favourite':
    case 'reblog':
    case 'status':
    case 'mention':
    case 'quote':
    case 'poll':
    case 'update':
    case 'quoted_update': {
      const { status_id: statusId, ...groupWithoutStatus } = group;
      return {
        statusId: statusId ?? undefined,
        sampleAccountIds,
        partial: false,
        ...groupWithoutStatus,
      };
    }
    case 'admin.report': {
      const { report, ...groupWithoutTargetAccount } = group;
      return {
        report: createReportFromJSON(report),
        sampleAccountIds,
        partial: false,
        ...groupWithoutTargetAccount,
      };
    }
    case 'severed_relationships':
      return {
        ...group,
        partial: false,
        event: createAccountRelationshipSeveranceEventFromJSON(group.event),
        sampleAccountIds,
      };
    case 'moderation_warning': {
      const { moderation_warning, ...groupWithoutModerationWarning } = group;
      return {
        ...groupWithoutModerationWarning,
        partial: false,
        moderationWarning: createAccountWarningFromJSON(moderation_warning),
        sampleAccountIds,
      };
    }
    case 'annual_report': {
      const { annual_report, ...groupWithoutAnnualReport } = group;
      return {
        ...groupWithoutAnnualReport,
        partial: false,
        annualReport: createAnnualReportEventFromJSON(annual_report),
        sampleAccountIds,
      };
    }
    case 'event_invitation':
      return {
        ...group,
        partial: false,
        eventInvitation: group.event_invitation,
        sampleAccountIds,
      };
    case 'proposal_status_changed':
    case 'proposal_challenged':
      return {
        ...group,
        partial: false,
        proposal: group.proposal,
        sampleAccountIds,
      };
    case 'task_assigned':
      return {
        ...group,
        partial: false,
        task: group.task,
        sampleAccountIds,
      };
    case 'nudge':
      return {
        ...group,
        partial: false,
        nudgeStreak: group.nudge_streak,
        nudgeMessage: group.nudge_message
          ? {
              body: group.nudge_message.body,
              mediaUrl: group.nudge_message.media_url,
              voiceUrl: group.nudge_message.voice_url,
              inReplyTo: group.nudge_message.in_reply_to
                ? {
                    body: group.nudge_message.in_reply_to.body,
                    mediaUrl: group.nudge_message.in_reply_to.media_url,
                  }
                : null,
            }
          : undefined,
        nudgeReactions: group.nudge_reactions,
        sampleAccountIds,
      };
    case 'media_tag':
      return {
        ...group,
        partial: false,
        mediaTagPreviewUrl: group.media_tag_preview_url,
        mediaTagStatusPath: group.media_tag_status_path,
        sampleAccountIds,
      };
    case 'email_confirmation_reminder':
      return {
        ...group,
        partial: false,
        emailConfirmationEmail: group.email_confirmation_email,
        sampleAccountIds,
      };
    default:
      return {
        sampleAccountIds,
        partial: false,
        ...group,
      };
  }
}

export function createNotificationGroupFromNotificationJSON(
  notification: ApiNotificationJSON,
): NotificationGroup {
  const group = {
    sampleAccountIds: [notification.account.id],
    group_key: notification.group_key,
    notifications_count: 1,
    most_recent_notification_id: notification.id,
    page_min_id: notification.id,
    page_max_id: notification.id,
    latest_page_notification_at: notification.created_at,
    partial: true,
  };

  switch (notification.type) {
    case 'favourite':
    case 'reblog':
    case 'status':
    case 'mention':
    case 'quote':
    case 'poll':
    case 'update':
    case 'quoted_update':
      return {
        ...group,
        type: notification.type,
        statusId: notification.status?.id,
      };
    case 'admin.report':
      return {
        ...group,
        type: notification.type,
        report: createReportFromJSON(notification.report),
      };
    case 'severed_relationships':
      return {
        ...group,
        type: notification.type,
        event: createAccountRelationshipSeveranceEventFromJSON(
          notification.event,
        ),
      };
    case 'moderation_warning':
      return {
        ...group,
        type: notification.type,
        moderationWarning: createAccountWarningFromJSON(
          notification.moderation_warning,
        ),
      };
    case 'event_invitation':
      return {
        ...group,
        type: notification.type,
        eventInvitation: notification.event_invitation,
      };
    case 'proposal_status_changed':
    case 'proposal_challenged':
      return {
        ...group,
        type: notification.type,
        proposal: notification.proposal,
      };
    case 'task_assigned':
      return {
        ...group,
        type: notification.type,
        task: notification.task,
      };
    case 'nudge':
      return {
        ...group,
        type: notification.type,
        nudgeStreak: notification.nudge_streak,
        nudgeMessage: notification.nudge_message
          ? {
              body: notification.nudge_message.body,
              mediaUrl: notification.nudge_message.media_url,
              voiceUrl: notification.nudge_message.voice_url,
              inReplyTo: notification.nudge_message.in_reply_to
                ? {
                    body: notification.nudge_message.in_reply_to.body,
                    mediaUrl: notification.nudge_message.in_reply_to.media_url,
                  }
                : null,
            }
          : undefined,
        nudgeReactions: notification.nudge_reactions,
      };
    case 'media_tag':
      return {
        ...group,
        type: notification.type,
        mediaTagPreviewUrl: notification.media_tag_preview_url,
        mediaTagStatusPath: notification.media_tag_status_path,
      };
    case 'email_confirmation_reminder':
      return {
        ...group,
        type: notification.type,
        emailConfirmationEmail: notification.email_confirmation_email,
      };
    default:
      return {
        ...group,
        type: notification.type,
      };
  }
}
