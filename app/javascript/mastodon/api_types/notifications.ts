// See app/serializers/rest/notification_group_serializer.rb

import type { AccountWarningAction } from 'mastodon/models/notification_group';

import type { ApiAccountJSON } from './accounts';
import type { ApiReportJSON } from './reports';
import type { ApiStatusJSON } from './statuses';

// See app/model/notification.rb
export const allNotificationTypes: NotificationType[] = [
  'follow',
  'follow_request',
  'favourite',
  'reblog',
  'mention',
  'quote',
  'poll',
  'status',
  'update',
  'admin.sign_up',
  'admin.report',
  'moderation_warning',
  'severed_relationships',
  'annual_report',
  'event_invitation',
  'nudge',
  'media_tag',
  'proposal_status_changed',
  'proposal_challenged',
  'task_assigned',
  'email_confirmation_reminder',
];

export type NotificationWithStatusType =
  | 'favourite'
  | 'reblog'
  | 'status'
  | 'mention'
  | 'quote'
  | 'poll'
  | 'update'
  | 'quoted_update';

export type NotificationType =
  | NotificationWithStatusType
  | 'follow'
  | 'follow_request'
  | 'moderation_warning'
  | 'severed_relationships'
  | 'admin.sign_up'
  | 'admin.report'
  | 'annual_report'
  | 'event_invitation'
  | 'nudge'
  | 'media_tag'
  | 'proposal_status_changed'
  | 'proposal_challenged'
  | 'task_assigned'
  | 'email_confirmation_reminder';

export interface BaseNotificationJSON {
  id: string;
  type: NotificationType;
  created_at: string;
  group_key: string;
  account: ApiAccountJSON;
}

export interface BaseNotificationGroupJSON {
  group_key: string;
  notifications_count: number;
  type: NotificationType;
  sample_account_ids: string[];
  latest_page_notification_at: string; // FIXME: This will only be present if the notification group is returned in a paginated list, not requested directly
  most_recent_notification_id: string;
  page_min_id?: string;
  page_max_id?: string;
}

interface NotificationGroupWithStatusJSON extends BaseNotificationGroupJSON {
  type: NotificationWithStatusType;
  status_id: string | null;
}

interface NotificationWithStatusJSON extends BaseNotificationJSON {
  type: NotificationWithStatusType;
  status: ApiStatusJSON | null;
}

interface ReportNotificationGroupJSON extends BaseNotificationGroupJSON {
  type: 'admin.report';
  report: ApiReportJSON;
}

interface ReportNotificationJSON extends BaseNotificationJSON {
  type: 'admin.report';
  report: ApiReportJSON;
}

type SimpleNotificationTypes = 'follow' | 'follow_request' | 'admin.sign_up';
interface SimpleNotificationGroupJSON extends BaseNotificationGroupJSON {
  type: SimpleNotificationTypes;
}

interface SimpleNotificationJSON extends BaseNotificationJSON {
  type: SimpleNotificationTypes;
}

export interface ApiAccountWarningJSON {
  id: string;
  action: AccountWarningAction;
  text: string;
  status_ids: string[];
  created_at: string;
  target_account: ApiAccountJSON;
  appeal: unknown;
}

interface ModerationWarningNotificationGroupJSON
  extends BaseNotificationGroupJSON {
  type: 'moderation_warning';
  moderation_warning: ApiAccountWarningJSON;
}

interface ModerationWarningNotificationJSON extends BaseNotificationJSON {
  type: 'moderation_warning';
  moderation_warning: ApiAccountWarningJSON;
}

export interface ApiAccountRelationshipSeveranceEventJSON {
  id: string;
  type: 'account_suspension' | 'domain_block' | 'user_domain_block';
  purged: boolean;
  target_name: string;
  followers_count: number;
  following_count: number;
  created_at: string;
}

interface AccountRelationshipSeveranceNotificationGroupJSON
  extends BaseNotificationGroupJSON {
  type: 'severed_relationships';
  event: ApiAccountRelationshipSeveranceEventJSON;
}

interface AccountRelationshipSeveranceNotificationJSON
  extends BaseNotificationJSON {
  type: 'severed_relationships';
  event: ApiAccountRelationshipSeveranceEventJSON;
}

export interface ApiAnnualReportEventJSON {
  year: string;
}

interface AnnualReportNotificationGroupJSON extends BaseNotificationGroupJSON {
  type: 'annual_report';
  annual_report: ApiAnnualReportEventJSON;
}

export interface ApiEventInvitationJSON {
  event_id: string;
  event_title: string;
  event_start_time: string;
  event_type: string;
}

interface EventInvitationNotificationGroupJSON
  extends BaseNotificationGroupJSON {
  type: 'event_invitation';
  event_invitation: ApiEventInvitationJSON;
}

interface EventInvitationNotificationJSON extends BaseNotificationJSON {
  type: 'event_invitation';
  event_invitation: ApiEventInvitationJSON;
}

export interface ApiProposalCompleteJSON {
  proposal_id: string;
  proposal_title: string;
}

interface ProposalStatusChangedNotificationGroupJSON
  extends BaseNotificationGroupJSON {
  type: 'proposal_status_changed';
  proposal: ApiProposalCompleteJSON;
}

interface ProposalStatusChangedNotificationJSON extends BaseNotificationJSON {
  type: 'proposal_status_changed';
  proposal: ApiProposalCompleteJSON;
}

// proposal_challenged carries the same Proposal payload — a block vote on a
// proposal you authored. Registered and firing since #391; nothing rendered it
// until now (notification_retirement_plan.md phase 1).
interface ProposalChallengedNotificationGroupJSON
  extends BaseNotificationGroupJSON {
  type: 'proposal_challenged';
  proposal: ApiProposalCompleteJSON;
}

interface ProposalChallengedNotificationJSON extends BaseNotificationJSON {
  type: 'proposal_challenged';
  proposal: ApiProposalCompleteJSON;
}

// task_assigned carries the Task, plus its parent proposal id: tasks have no
// standalone route, so the client links to the proposal.
export interface ApiTaskAssignedJSON {
  task_id: string;
  task_title: string;
  proposal_id: string;
}

interface TaskAssignedNotificationGroupJSON extends BaseNotificationGroupJSON {
  type: 'task_assigned';
  task: ApiTaskAssignedJSON;
}

interface TaskAssignedNotificationJSON extends BaseNotificationJSON {
  type: 'task_assigned';
  task: ApiTaskAssignedJSON;
}

export interface NudgeMessageJSON {
  body: string | null;
  media_url: string | null;
  voice_url: string | null;
  in_reply_to: { body: string | null; media_url: string | null } | null;
}

export type NudgeReactionEmoji = '❤️' | '😂' | '🙌' | '🔥' | '😢';

export type NudgeReactionsJSON = Record<
  NudgeReactionEmoji,
  { count: number; me: boolean }
>;

interface NudgeNotificationGroupJSON extends BaseNotificationGroupJSON {
  type: 'nudge';
  nudge_streak: number;
  nudge_message?: NudgeMessageJSON;
  nudge_reactions: NudgeReactionsJSON;
}

interface NudgeNotificationJSON extends BaseNotificationJSON {
  type: 'nudge';
  nudge_streak: number;
  nudge_message?: NudgeMessageJSON;
  nudge_reactions: NudgeReactionsJSON;
}

interface MediaTagNotificationGroupJSON extends BaseNotificationGroupJSON {
  type: 'media_tag';
  media_tag_preview_url: string | null;
  media_tag_status_path: string | null;
}

interface MediaTagNotificationJSON extends BaseNotificationJSON {
  type: 'media_tag';
  media_tag_preview_url: string | null;
  media_tag_status_path: string | null;
}

interface EmailConfirmationReminderNotificationGroupJSON
  extends BaseNotificationGroupJSON {
  type: 'email_confirmation_reminder';
  email_confirmation_email: string | null;
}

interface EmailConfirmationReminderNotificationJSON
  extends BaseNotificationJSON {
  type: 'email_confirmation_reminder';
  email_confirmation_email: string | null;
}

export type ApiNotificationJSON =
  | SimpleNotificationJSON
  | ReportNotificationJSON
  | AccountRelationshipSeveranceNotificationJSON
  | NotificationWithStatusJSON
  | ModerationWarningNotificationJSON
  | EventInvitationNotificationJSON
  | NudgeNotificationJSON
  | MediaTagNotificationJSON
  | ProposalStatusChangedNotificationJSON
  | ProposalChallengedNotificationJSON
  | TaskAssignedNotificationJSON
  | EmailConfirmationReminderNotificationJSON;

export type ApiNotificationGroupJSON =
  | SimpleNotificationGroupJSON
  | ReportNotificationGroupJSON
  | AccountRelationshipSeveranceNotificationGroupJSON
  | NotificationGroupWithStatusJSON
  | ModerationWarningNotificationGroupJSON
  | AnnualReportNotificationGroupJSON
  | EventInvitationNotificationGroupJSON
  | NudgeNotificationGroupJSON
  | MediaTagNotificationGroupJSON
  | ProposalStatusChangedNotificationGroupJSON
  | ProposalChallengedNotificationGroupJSON
  | TaskAssignedNotificationGroupJSON
  | EmailConfirmationReminderNotificationGroupJSON;

export interface ApiNotificationGroupsResultJSON {
  accounts: ApiAccountJSON[];
  statuses: ApiStatusJSON[];
  notification_groups: ApiNotificationGroupJSON[];
}

export interface ApiNotificationRequestJSON {
  id: string;
  created_at: string;
  updated_at: string;
  notifications_count: string;
  account: ApiAccountJSON;
  last_status?: ApiStatusJSON;
}
