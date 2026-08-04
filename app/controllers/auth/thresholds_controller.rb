# frozen_string_literal: true

# The threshold ceremony — three concentric rings around Ж, one vow
# per ring, crossed in order. See KRONK_SIGNUP.md §4 for the flow
# and §6 for the canonical vow copy.
#
# Crossing state is client-side and session-scoped until the single
# POST from the arrival panel. If a member abandons the page they
# start again at the first threshold on return; there is no partial
# credit, no back button between rings, no un-cross.
#
# The HTML gate that redirects here (for a signed-in user who hasn't
# crossed at the current version) lives in
# ApplicationController#require_crossed_thresholds! — wired up in a
# later layer. API/OAuth paths deliberately stay open.
class Auth::ThresholdsController < ApplicationController
  layout 'kronk_void'

  before_action :authenticate_user!

  # Skip the require_functional! chain — a member reaches the ceremony
  # via a redirect from that same chain (once wired). Letting it re-fire
  # would loop.
  skip_before_action :require_functional!

  def show
    redirect_to(root_path) && return if current_user.crossed_thresholds?
  end

  def create
    unless Kronk::Thresholds::KEYS.all? { |key| ActiveModel::Type::Boolean.new.cast(params[key]) }
      # Missing any vow → re-render the first threshold. Do not partially
      # credit; the ceremony is atomic. The `alert` key is added by
      # layer 4 (locale file).
      redirect_to(auth_thresholds_path, alert: I18n.t('kronk.thresholds.errors.incomplete')) && return
    end

    # `record_thresholds_crossing!` is a `User#update!` — it triggers
    # every model validation (email format, MX check when email
    # changes, etc.) and every `after_commit` (Devise notifications,
    # session tracking). A failure anywhere in that chain used to
    # bubble to a generic 500 that told the member nothing except
    # "sorry, something went wrong" AFTER they'd committed to all
    # three vows — the worst possible failure mode for a ritual
    # surface. Catch broadly, log with the user id + exception, then
    # redirect back to the ceremony with an actionable alert so the
    # member can retry.
    begin
      current_user.record_thresholds_crossing!
    rescue ActiveRecord::RecordInvalid, ActiveRecord::StatementInvalid, StandardError => e
      Rails.logger.error(
        "Threshold crossing failed for user_id=#{current_user.id} " \
        "(#{e.class}): #{e.message}\n#{e.backtrace&.first(5)&.join("\n")}"
      )
      redirect_to(auth_thresholds_path, alert: I18n.t('kronk.thresholds.errors.crossing_failed'))
      return
    end

    redirect_to root_path
  end
end
