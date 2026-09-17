# frozen_string_literal: true

# Automated post deletion — the SPA face of `AccountStatusesCleanupPolicy`.
# The classic Rails page at `/statuses_cleanup` was the only surface for
# ten fields (enabled + min_status_age + six keep-* exceptions + min_favs
# + min_reblogs) — the frontend previously only linked out to it.
#
# The policy row is per-account. #show lazily builds a disabled one so
# the SPA can render every field even for accounts that have never
# opened the page; #update writes through ActiveRecord validations so
# `min_status_age` is constrained to the same eight preset windows the
# classic view uses.
#
#   GET /api/v1/settings/statuses_cleanup
#     => { enabled, min_status_age, keep_direct, keep_pinned, keep_polls,
#          keep_media, keep_self_fav, keep_self_bookmark, min_favs,
#          min_reblogs, min_status_age_options }
#
#   PUT /api/v1/settings/statuses_cleanup
#     body: any subset of the above (except min_status_age_options — that's
#     read-only). Missing keys keep their current value.
class Api::V1::Settings::StatusesCleanupController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  BOOLEAN_FIELDS = %w(enabled keep_direct keep_pinned keep_polls keep_media keep_self_fav keep_self_bookmark).freeze
  # `min_status_age` is an integer chosen from a whitelist enforced by the
  # model (`AccountStatusesCleanupPolicy::ALLOWED_MIN_STATUS_AGE`); the two
  # thresholds are nullable positive integers ("no minimum").
  INTEGER_FIELDS = %w(min_status_age min_favs min_reblogs).freeze
  NULLABLE_INTEGER_FIELDS = %w(min_favs min_reblogs).freeze

  def show
    render json: payload
  end

  def update
    updates = {}

    BOOLEAN_FIELDS.each do |name|
      next unless params.key?(name)

      updates[name] = ActiveModel::Type::Boolean.new.cast(params[name])
    end

    INTEGER_FIELDS.each do |name|
      next unless params.key?(name)

      raw = params[name]
      updates[name] = if NULLABLE_INTEGER_FIELDS.include?(name) && raw.blank?
                        nil
                      else
                        Integer(raw.to_s, exception: false)
                      end
    end

    if policy.update(updates)
      render json: payload
    else
      render json: { error: policy.errors.full_messages.to_sentence }, status: 422
    end
  end

  private

  # Lazily materialised: an account that has never opened the cleanup
  # page has no row, but the SPA still needs the schema + defaults. A
  # persisted-but-disabled row appears the first time #update lands.
  def policy
    @policy ||= current_account.statuses_cleanup_policy ||
                current_account.build_statuses_cleanup_policy(enabled: false)
  end

  def payload
    {
      'enabled' => policy.enabled,
      'min_status_age' => policy.min_status_age,
      'keep_direct' => policy.keep_direct,
      'keep_pinned' => policy.keep_pinned,
      'keep_polls' => policy.keep_polls,
      'keep_media' => policy.keep_media,
      'keep_self_fav' => policy.keep_self_fav,
      'keep_self_bookmark' => policy.keep_self_bookmark,
      'min_favs' => policy.min_favs,
      'min_reblogs' => policy.min_reblogs,
      'min_status_age_options' => AccountStatusesCleanupPolicy::ALLOWED_MIN_STATUS_AGE,
    }
  end
end
