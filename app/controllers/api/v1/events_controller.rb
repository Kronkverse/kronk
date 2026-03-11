# frozen_string_literal: true

class Api::V1::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show, :attendees, :my_invitees]
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
      invitation = @event.invitations.find_or_initialize_by(account: account, invited_by: current_account)

      if invitation.new_record?
        invitation.save!
        NotifyService.new.call(account, :event_invitation, invitation)
      else
        invitation.save!
      end
    end

    render json: @event, serializer: REST::EventSerializer
  end

  def my_invitees
    account_ids = @event.invitations
                        .where(invited_by: current_account)
                        .pluck(:account_id)
    render json: { account_ids: account_ids.map(&:to_s) }
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
    status_text = event.title

    visibility = params[:visibility] || current_account.user&.setting_default_privacy || 'public'

    @status = PostStatusService.new.call(
      current_account,
      text: status_text,
      visibility: visibility,
      application: doorkeeper_token.application
    )

    event.update!(status: @status)
  end
  end
