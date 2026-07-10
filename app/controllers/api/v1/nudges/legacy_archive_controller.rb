# frozen_string_literal: true

# Read-only archive of the current account's `legacy: true` notifications
# (mention, favourite, reblog, follow, etc. — everything in
# Notification::LEGACY_TYPES). Powers the transitional "Legacy" tab
# inside the Nudges surface during the 2.0.0 rebuild's Nudges cutover
# (task #30). Once every downstream client has swept, the archive tab
# is removed and legacy types stop generating new rows.
#
#   GET /api/v1/nudges/legacy?max_id=&min_id=&limit=
class Api::V1::Nudges::LegacyArchiveController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:notifications' }
  before_action :require_user!

  DEFAULT_LIMIT = 40

  def index
    notifications = current_account.notifications
                                   .legacy_archive
                                   .without_suspended
                                   .includes(from_account: :account_stat)
                                   .order(id: :desc)
                                   .limit(limit_param(DEFAULT_LIMIT))

    notifications = notifications.where(Notification.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    notifications = notifications.where(Notification.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    render json: notifications, each_serializer: REST::NotificationSerializer,
           relationships: StatusRelationshipsPresenter.new(preloaded_statuses(notifications), current_user.account_id)
  end

  private

  def preloaded_statuses(notifications)
    ids = notifications.map(&:activity_id).compact.uniq
    Status.where(id: ids)
  end
end
