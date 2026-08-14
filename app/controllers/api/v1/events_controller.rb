# frozen_string_literal: true

class Api::V1::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show, :attendees, :my_invitees]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :rsvp, :invite]
  before_action :require_user!
  before_action :set_event, except: [:index, :create]
  # Enforce Event#visible_to? on every non-index read + on RSVP.
  # `rsvp` needs the check too — otherwise a non-invitee arriving at
  # `POST /events/:id/rsvp` could shove themselves into a private
  # event. Owner-only actions (`update`, `destroy`, `invite`,
  # `my_invitees`) already gate through `authorize_event_owner!`,
  # which is a stricter check than `visible_to?` — no double-gate
  # needed there.
  before_action :authorize_event_visible!, only: [:show, :attendees, :rsvp]

  def index
    @events = filtered_events.visible_to(current_account).includes(:account, :image, :status).limit(40)
    render json: @events, each_serializer: REST::EventSerializer
  end

  def show
    render json: @event, serializer: REST::EventSerializer
  end

  def create
    @event = current_account.events.new(event_params)

    @event.huddle_url = 'https://meet.talitamoss.info/huddle' if @event.event_type_huddle?

    set_image! if params[:image_id].present?

    # Save event first; create the status outside the transaction.
    # PostStatusService enqueues DistributionWorker via Sidekiq.perform_async,
    # which starts running immediately — before this transaction commits.
    # DistributionWorker.rescue silently swallows ActiveRecord::RecordNotFound,
    # so the fanout to home feeds never runs and the status is orphaned
    # from every timeline (visible only on the author profile / direct URL).
    @event.save!
    create_status_for_event!(@event) if params[:post_to_feed] != false

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

    @event.update!(huddle_url: 'https://meet.talitamoss.info/huddle') if @event.event_type_huddle? && @event.huddle_url.blank?

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
    authorize_event_owner!

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

  # Read gate for `show` / `attendees` / `rsvp`. `visible_to?` is the
  # single source of truth (author + invitees + Status reach when
  # not invite_only) — see Event#visible_to? for the rule.
  def authorize_event_visible!
    raise Mastodon::NotPermittedError unless @event.visible_to?(current_account)
  end

  def set_image!
    @event.image = current_account.media_attachments.find(params[:image_id])
  end

  def event_params
    params.permit(
      :title, :description, :start_time, :end_time,
      :location_name, :location_url, :event_type,
      :rsvp_enabled, :max_attendees, :recurrence_rule,
      :spawn_album, :invite_only
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

    # invite_only events force `self_only` on the underlying Status
    # so nothing fans out to feeds — access is gated by
    # Event#visible_to? via the invitations join table, not by
    # StatusPolicy on the timeline. Non-invite-only events use the
    # caller's requested visibility, falling back to their default
    # privacy setting or 'public' (Kronkverse — the platform is
    # unfederated so 'public' means the whole Kronk instance).
    visibility = if event.invite_only?
                   'self_only'
                 else
                   params[:visibility] || current_account.user&.setting_default_privacy || 'public'
                 end

    @status = PostStatusService.new.call(
      current_account,
      text: status_text,
      visibility: visibility,
      application: doorkeeper_token.application
    )

    event.update!(status: @status)
    @status.update_column(:source_korner, 'kalendar') # feed projection discriminator (§3.2)
    @status.touch
  end
end
