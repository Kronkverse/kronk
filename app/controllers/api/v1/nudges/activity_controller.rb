# frozen_string_literal: true

# Read-only activity feed for the current account, aggregated via
# Nudges::Aggregator so repeated (type, subject) pairs within each
# type's window collapse into a single row. Powers the Activity tab
# inside the Nudges surface — the chat-form UI that replaces the
# classic bell (spec §N, plan Phase 5.4).
#
#   GET /api/v1/nudges/activity?max_id=&min_id=&limit=
#
# Response shape (one entry per aggregated group):
#   {
#     "id":            "<type>-<subject_type>-<subject_id>-<latest_notif_id>",
#     "type":          "favourite",
#     "subject_type":  "Status",
#     "subject_id":    "42",
#     "count":         5,
#     "latest_at":     "2026-07-10T12:34:56Z",
#     "actors":        [<AccountJSON>, ...],
#     "notification":  <NotificationJSON>          # the most recent notification in the group
#   }
class Api::V1::Nudges::ActivityController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:notifications' }
  before_action :require_user!

  DEFAULT_LIMIT = 40
  MAX_LIMIT     = 80

  def index
    notifications = current_account.notifications
                                   .browserable(exclude_types: Notification::LEGACY_TYPES)
                                   .without_suspended
                                   .includes(from_account: :account_stat)
                                   .order(id: :desc)
                                   .limit([limit_param(DEFAULT_LIMIT), MAX_LIMIT].min)

    notifications = notifications.where(Notification.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    notifications = notifications.where(Notification.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    groups = Nudges::Aggregator.for(notifications).reverse

    render json: groups.map { |g| serialize_group(g) }
  end

  private

  def serialize_group(group)
    latest = group.notifications.last

    {
      id:           "#{group.type}-#{group.subject_type}-#{group.subject_id}-#{latest.id}",
      type:         group.type,
      subject_type: group.subject_type,
      subject_id:   group.subject_id&.to_s,
      count:        group.count,
      latest_at:    group.latest_at.iso8601,
      actors:       serialized_actors(group.actors),
      notification: ActiveModelSerializers::SerializableResource.new(
        latest,
        serializer: REST::NotificationSerializer
      ).as_json,
    }
  end

  def serialized_actors(actors)
    ActiveModelSerializers::SerializableResource.new(
      actors,
      each_serializer: REST::AccountSerializer
    ).as_json
  end
end
