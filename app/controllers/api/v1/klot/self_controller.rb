# frozen_string_literal: true

# Klot — the owner's own cycle. Returns the full state (day of cycle,
# phase, what the log says about the cycle, the periods themselves) and
# takes the writes: periods (start, end, change, remove), what a day was
# like, and clearing everything.
#
# This is the ONLY controller that ever reads a kronker's logs, days and
# lengths. Everything viewer-facing goes through
# Api::V1::Klot::CircleController, which projects strictly the phase.
# Requests are scoped to `current_account`: no :account_id in the path,
# so there is nothing to spoof.
class Api::V1::Klot::SelfController < Api::BaseController
  # A calendar asks for a month or so at a time; a year is the most.
  MAX_DAYS_SPAN = 400

  before_action -> { doorkeeper_authorize! :read,  :'read:accounts' },  only: [:show, :days]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, except: [:show, :days]
  before_action :require_user!

  rescue_from ActiveRecord::RecordInvalid, Date::Error do |e|
    render json: { error: e.message }, status: 422
  end

  def show
    render_self_state
  end

  # POST /api/v1/klot/self/logs — a period started (today unless told).
  def create_log
    CycleLog.start!(
      account: current_account,
      started_on: date_param(:started_on) || Time.zone.today,
      usual_length: CycleLog.stats_for(current_account)[:period_length]
    )

    render_self_state
  end

  # PATCH /api/v1/klot/self/logs/:id — it ended, or a date was wrong.
  # `ended_on: ''` reopens it.
  def update_log
    log = current_account_log
    return render json: { error: 'not_found' }, status: 404 if log.nil?

    log.started_on = date_param(:started_on) if params[:started_on].present?
    log.ended_on   = date_param(:ended_on) if params.key?(:ended_on)
    log.save!

    render_self_state
  end

  def destroy_log
    log = current_account_log
    return render json: { error: 'not_found' }, status: 404 if log.nil?

    log.destroy!
    render_self_state
  end

  # GET /api/v1/klot/self/days?from=2026-10-01&to=2026-10-31
  def days
    from = date_param(:from) || Time.zone.today.beginning_of_month
    to   = [date_param(:to) || from.end_of_month, from + MAX_DAYS_SPAN].min

    render json: CycleDay.where(account: current_account).between(from, to).map { |day| day_json(day) }
  end

  # PUT /api/v1/klot/self/days/:day — how that day was. Sending nothing
  # for all three clears the day.
  def update_day
    day = CycleDay.find_or_initialize_by(account: current_account, day: Date.iso8601(params[:day].to_s))
    day.flow     = params[:flow] if params.key?(:flow)
    day.symptoms = params[:symptoms] if params.key?(:symptoms)
    day.note     = params[:note] if params.key?(:note)

    if day.blank_entry?
      day.destroy! if day.persisted?
    else
      day.save!
    end

    render json: day_json(day)
  end

  # DELETE /api/v1/klot/self/data — every period and every day, gone.
  def clear
    CycleLog.where(account: current_account).delete_all
    CycleDay.where(account: current_account).delete_all

    render_self_state
  end

  def update_settings
    profile = CycleProfile.for!(current_account)
    profile.update!(settings_params)

    render_self_state
  end

  private

  def current_account_log
    CycleLog.where(account: current_account, id: params[:id]).first
  end

  def date_param(name)
    Date.iso8601(params[name].to_s) if params[name].present?
  end

  def day_json(day)
    { day: day.day.iso8601, flow: day.flow, symptoms: day.symptoms, note: day.note }
  end

  def render_self_state
    render json: REST::Klot::SelfSerializer.new(self_state).as_json
  end

  def self_state
    logs    = CycleLog.where(account: current_account).newest_first.to_a
    stats   = CycleLog.stats_for(current_account, logs: logs)
    derived = Kronk::CyclePhase.derive(
      cycle_length: stats[:cycle_length],
      period_length: stats[:current_period_length],
      most_recent_start: logs.first&.started_on
    )

    stats.merge(day_of_cycle: derived[:day_of_cycle], phase: derived[:phase], logs: logs)
  end

  def settings_params
    params.permit(:cycle_length, :period_length)
  end
end
