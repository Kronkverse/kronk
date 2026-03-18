# frozen_string_literal: true

class Api::V1::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show, :attendees]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :rsvp, :invite]
  before_action :require_user!
  before_action :set_event, except: [:index, :create]

  def index
    @events = filtered_events.includes(:account, :image, :status).limit(40)
    render json: @events, each_serializer: REST::EventSerializer
  end

  def show
    render json: @event, serializer: REST::EventSerializer
  end

  def create
    @event = current_account.events.new(event_params)

    if @event.event_type_huddle?
      @event.huddle_url = 'https://meet.talitamoss.info/huddle'
    end

    set_image! if params[:image_id].present?

    ApplicationRecord.transaction do
      @event.save!
      create_status_for_event!(@event) if params[:post_to_feed] != false
    end

    render json: @event, serializer: REST::EventSerializer
  end

  def update
    authorize_event_owner!

    if params[:image_id].present?
      set_image!
    elsif params[:remove_image] == 'true'
      @event.image = nil
    end

    @event.update!(event_params)

    if @event.event_type_huddle? && @event.huddle_url.blank?
      @event.update!(huddle_url: 'https://meet.talitamoss.info/huddle')
    end

    render json: @event, serializer: REST::EventSerializer
  end

  def destroy
    authorize_event_owner!
    @event.destroy!
    render_empty
  end

  def rsvp
    rsvp = @event.rsvps.find_or_initialize_by(account: current_account)

    if params[:status] == 'remove'
      rsvp.destroy! if rsvp.persisted?
    else
      rsvp.status = params[:status]
      rsvp.save!
    end

    render json: @event, serializer: REST::EventSerializer
  end

  def attendees
    @rsvps = @event.rsvps.includes(:account)
    @rsvps = @rsvps.where(status: params[:status]) if params[:status].present?
    render json: @rsvps.map(&:account), each_serializer: REST::AccountSerializer
  end

  def invite
    account_ids = Array(params[:account_ids]).map(&:to_i)
    accounts = Account.where(id: account_ids)

    accounts.each do |account|
      invitation = @event.invitations.find_or_initialize_by(account: account)
      invitation.invited_by = current_account

      if invitation.new_record?
        invitation.save!
        NotifyService.new.call(account, :event_invitation, invitation)
        send_event_invite_dm!(account)
      else
        invitation.save!
      end
    end

    render json: @event, serializer: REST::EventSerializer
  end

  private

  def set_event
    @event = Event.find(params[:id])
  end

  def authorize_event_owner!
    raise Mastodon::NotPermittedError unless @event.account_id == current_account.id
  end

  def set_image!
    @event.image = current_account.media_attachments.find(params[:image_id])
  end

  def event_params
    params.permit(
      :title, :description, :start_time, :end_time,
      :location_name, :location_url, :event_type,
      :rsvp_enabled, :max_attendees, :recurrence_rule
    )
  end

  def filtered_events
    scope = Event.not_cancelled.root_events

    case params[:filter]
    when 'past'
      scope.past
    when 'mine'
      scope.where(account: current_account)
    when 'invited'
      scope.joins(:invitations).where(event_invitations: { account: current_account })
    else
      scope.upcoming
    end
  end

  def create_status_for_event!(event)
    status = PostStatusService.new.call(
      current_account,
      text: event_status_text(event),
      visibility: event_params[:visibility] || "public",
      language: current_account.user&.preferred_posting_language
    )

    event.update!(status: status)
  end

  def event_status_text(event)
    lines = []
    lines << event.title
    lines << ""

    start_t = event.start_time&.in_time_zone(Time.zone)
    if start_t
      date_line = start_t.strftime("%A, %B %-d · %l:%M %p").squeeze(" ")
      if event.end_time
        end_t = event.end_time.in_time_zone(Time.zone)
        if end_t.to_date == start_t.to_date
          date_line += end_t.strftime(" – %l:%M %p").squeeze(" ")
        else
          date_line += end_t.strftime(" – %B %-d, %l:%M %p").squeeze(" ")
        end
      end
      lines << date_line
    end

    lines << event.location_name if event.location_name.present?
    lines << ""
    lines << event_url(event)

    lines.join("\n")
  end

  def event_url(event)
    domain = Rails.configuration.x.local_domain
    base = domain.start_with?("http") ? domain : "https://#{domain}"
    "#{base}/events/#{event.id}"
  end

def send_event_invite_dm!(account)
    kronk_native_apps = %w[Kronk Web].freeze
    authorized_apps = Doorkeeper::AccessToken
      .where(resource_owner_id: account.user&.id)
      .where(revoked_at: nil)
      .joins(:application)
      .pluck(Arel.sql('DISTINCT oauth_applications.name'))

    return if authorized_apps.present? && authorized_apps.all? { |name| kronk_native_apps.include?(name) }

    event_url = "https://#{Rails.configuration.x.local_domain}/events/#{@event.id}"
    dm_text = "@#{account.username} You have been invited to \"#{@event.title}\"\n#{event_url}"

    PostStatusService.new.call(
      current_account,
      text: dm_text,
      visibility: :direct
    )
  rescue => e
    Rails.logger.warn("Failed to send event invite DM to #{account.username}: #{e.message}")
  end
end
