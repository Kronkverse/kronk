# frozen_string_literal: true

module Account::Associations
  extend ActiveSupport::Concern

  included do
    # Core associations
    with_options dependent: :destroy do
      # Association where account owns record
      with_options inverse_of: :account do
        has_many :account_moderation_notes
        has_many :account_pins
        has_many :account_warnings
        has_many :aliases, class_name: 'AccountAlias'
        has_many :bookmarks
        has_many :conversations, class_name: 'AccountConversation'
        has_many :custom_filters
        has_many :booth_sets
        has_many :events
        has_many :favourites
        has_many :featured_tags, -> { includes(:tag) }
        has_many :list_accounts
        has_many :instance_moderation_notes
        has_many :media_attachments
        has_many :media_tags, dependent: :destroy
        has_many :tagged_in_media, through: :media_tags, source: :media_attachment
        has_many :mentions
        has_many :migrations, class_name: 'AccountMigration'
        has_many :notification_permissions
        has_many :notification_requests
        has_many :notifications
        has_many :owned_lists, class_name: 'List'
        has_many :polls
        has_many :report_notes
        has_many :reports
        has_many :scheduled_statuses
        has_many :status_pins
        has_many :statuses

        has_one :deletion_request, class_name: 'AccountDeletionRequest'
        has_one :follow_recommendation_suppression
        has_one :notification_policy
        has_one :statuses_cleanup_policy, class_name: 'AccountStatusesCleanupPolicy'
        has_one :user
      end

      # Association where account is targeted by record
      with_options foreign_key: :target_account_id, inverse_of: :target_account do
        has_many :strikes, class_name: 'AccountWarning'
        has_many :targeted_moderation_notes, class_name: 'AccountModerationNote'
        has_many :targeted_reports, class_name: 'Report'
      end
    end

    # Status records pinned by the account
    has_many :pinned_statuses, -> { reorder(status_pins: { created_at: :desc }) }, through: :status_pins, class_name: 'Status', source: :status

    # Account records endorsed (pinned) by the account
    has_many :endorsed_accounts, through: :account_pins, class_name: 'Account', source: :target_account

    # List records the account has been added to (not owned by the account)
    has_many :lists, through: :list_accounts

    # Account record where account has been migrated
    belongs_to :moved_to_account, class_name: 'Account', optional: true

    # Tag records applied to account
    has_and_belongs_to_many :tags # rubocop:disable Rails/HasAndBelongsToMany

    # FollowRecommendation for account (surfaced via view)
    has_one :follow_recommendation, inverse_of: :account, dependent: nil

    # BulkImport records owned by account
    has_many :bulk_imports, inverse_of: :account, dependent: :delete_all

    # Korner tune-outs — presence of a row means the account has opted
    # out of that korner. Absence is the default (tuned in). Cascade
    # delete rather than destroy — no callbacks to run.
    has_many :korner_tune_outs, inverse_of: :account, dependent: :delete_all

    # Per-account Hub grid ordering — absence of rows falls back to the
    # default (tune-in popularity per Kronk::TuneInCounts).
    has_many :user_hub_orders, inverse_of: :account, dependent: :delete_all

    # Group memberships (§Groups). Cascade delete rather than destroy —
    # membership carries no callbacks beyond timestamps.
    has_many :group_memberships, inverse_of: :account, dependent: :delete_all
    has_many :groups, through: :group_memberships

    # Kuestions v2: an account has answers (one per question), and can
    # be the creator of questions. Cascade delete on account destroy.
    has_many :answers, inverse_of: :account, dependent: :delete_all
    has_many :created_questions, class_name: 'Question', foreign_key: :created_by_account_id, dependent: :destroy, inverse_of: :created_by_account
  end
end
