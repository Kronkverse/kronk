# frozen_string_literal: true

# Klot — owner endpoints. Everything here is scoped to the caller;
# nothing on this controller ever surfaces another account's raw
# log/settings (KRONK_TIDES §Consent invariants).
#
#   GET    /api/v1/klot/self
#     { day_of_cycle, phase, cycle_length, period_length, logs: [...] }
#   POST   /api/v1/klot/self/logs           { started_on? }
#   DELETE /api/v1/klot/self/logs/:id
#   PATCH  /api/v1/klot/self/settings       { cycle_length?, period_length? }
class Api::V1::Klot::SelfController < Api::BaseController
  # Klot has been intermittently 500'ing on shadow for at least one
  # signed-in account (see the alpha.223 follow-up note). Rails.env
  # production suppresses the error body, so this rescue surfaces the
  # class + message into the JSON response *and* logs the backtrace to
  # production.log so `journalctl -u sidekiq` and friends can be
  # grepped. Provisional — remove once the root cause is fixed.
  rescue_from StandardError, with: :render_klot_diagnostic

  before_action -> { doorkeeper_authorize! :read,  :'read:accounts' },  only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create_log, :destroy_log, :update_settings]
  before_action :require_user!

  def show
    render json: self_state, serializer: REST::Klot::SelfSerializer
  end

  def create_log
    started_on = params[:started_on].presence ? Date.parse(params[:started_on].to_s) : Time.zone.today
    CycleLog.create!(account: current_account, started_on: started_on)

    render json: self_state, serializer: REST::Klot::SelfSerializer
  rescue ActiveRecord::RecordInvalid, ArgumentError => e
    render json: { error: e.message }, status: 422
  end

  def destroy_log
    log = CycleLog.where(account: current_account, id: params[:id]).first
    return render json: { error: 'not_found' }, status: 404 if log.nil?

    log.destroy!
    render json: self_state, serializer: REST::Klot::SelfSerializer
  end

  def update_settings
    profile = CycleProfile.for!(current_account)
    profile.update!(settings_params)

    render json: self_state, serializer: REST::Klot::SelfSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  private

  # Assemble the owner-visible state: settings + logs + derived phase.
  # Kept as a plain Hash so REST::Klot::SelfSerializer can serialize it
  # without having to touch the profile record directly (keeps the
  # projection surface small — see §Consent invariants).
  def self_state
    profile = CycleProfile.for!(current_account)
    logs    = CycleLog.where(account: current_account).newest_first
    derived = Kronk::CyclePhase.derive(
      cycle_length: profile.cycle_length,
      period_length: profile.period_length,
      most_recent_start: logs.first&.started_on
    )

    {
      day_of_cycle: derived[:day_of_cycle],
      phase: derived[:phase],
      cycle_length: profile.cycle_length,
      period_length: profile.period_length,
      logs: logs,
    }
  end

  def settings_params
    params.permit(:cycle_length, :period_length)
  end

  # Provisional error surface — see the class-level rescue_from. Emits
  # a JSON body the SPA already renders via setError(err.message) and a
  # backtrace to production.log so we can diagnose the 500 without SSH.
  # Standard 500-mapped errors (auth, params, etc.) are still handled
  # by Api::BaseController's own rescues above us; this only catches
  # what would otherwise become an opaque 500.
  def render_klot_diagnostic(exception)
    Rails.logger.error(
      "[klot/self] #{exception.class}: #{exception.message}\n  " \
      "by account_id=#{current_account&.id.inspect}\n  " \
      "#{Array(exception.backtrace).first(15).join("\n  ")}"
    )
    render json: {
      error: "#{exception.class}: #{exception.message}",
      hint: 'Klot self endpoint tripped — see production.log for the full backtrace.', # rubocop:disable I18n/RailsI18n/DecorateString -- provisional debug hint, English-only
    }, status: 500
  end
end
