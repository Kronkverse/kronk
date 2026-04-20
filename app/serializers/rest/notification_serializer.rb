# frozen_string_literal: true

class REST::NotificationSerializer < ActiveModel::Serializer
  # Please update app/javascript/api_types/notification.ts when making changes to the attributes
  attributes :id, :type, :created_at, :group_key

  attribute :filtered, if: :filtered?

  belongs_to :from_account, key: :account, serializer: REST::AccountSerializer
  belongs_to :target_status, key: :status, if: :status_type?, serializer: REST::StatusSerializer
  belongs_to :report, if: :report_type?, serializer: REST::ReportSerializer
  belongs_to :account_relationship_severance_event, key: :event, if: :relationship_severance_event?, serializer: REST::AccountRelationshipSeveranceEventSerializer
  belongs_to :account_warning, key: :moderation_warning, if: :moderation_warning_event?, serializer: REST::AccountWarningSerializer

  def id
    object.id.to_s
  end

  def group_key
    object.group_key || "ungrouped-#{object.id}"
  end

  def status_type?
    [:favourite, :reblog, :status, :mention, :poll, :update, :quoted_update, :quote].include?(object.type)
  end

  def report_type?
    object.type == :'admin.report'
  end

  def relationship_severance_event?
    object.type == :severed_relationships
  end

  def moderation_warning_event?
    object.type == :moderation_warning
  end

  attribute :nudge_streak, if: :nudge_type?

  def nudge_type?
    object.type == :nudge
  end

  def nudge_streak
    a, b = object.account_id, object.from_account_id
    Notification.where(type: 'nudge')
                .where('(account_id = ? AND from_account_id = ?) OR (account_id = ? AND from_account_id = ?)', a, b, b, a)
                .count
  end

  delegate :filtered?, to: :object
end
