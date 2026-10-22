# frozen_string_literal: true

class Api::V1::EventsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show, :attendees, :my_invitees]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :rsvp, :invite]
  before_action :require_user!

  PAGE = 40
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
    scope = filtered_events.visible_to(current_account).includes(:account, :image, status: :krews)
    scope = for_krew(scope) if params[:krew_id].present?

    # `visible_to` only settles invite-only events. The reach of the rest
    # (Mates, Orbit, a Krew alone) is decided per event, as opening one
    # does, so the list never shows an event its viewer could not open.
    @events = scope.limit(PAGE * 3).select { |event| event.visible_to?(current_account) }.first(PAGE)
    render json: @events, each_serializer: REST::EventSerializer
  end

  def show
    render json: @event, serializer: REST::EventSerializer
  end

  def create
    @event = current_account.events.new(event_params)

    @event.huddle_url = "https://#{Rails.configuration.x.kronk_jitsi_domain}/huddle" if @event.event_type_huddle?

    set_image! if params[:image_id].present?

    @event.requested_reach = event_reach(@event)

    # Save event first; create the status outside the transaction.
    # PostStatusService enqueues DistributionWorker via Sidekiq.perform_async,
    # which starts running immediately — before this transaction commits.
    # DistributionWorker.rescue silently swallows ActiveRecord::RecordNotFound,
    # so the fanout to home feeds never runs and the status is orphaned
    # from every timeline (visible only on the author profile / direct URL).
    @event.save!
    create_status_for_event!(@event) if post_to_feed?

    render json: @event, serializer: REST::EventSerializer
  end

  def update
    authorize_event_owner!

    if params[:image_id].present?
      set_image!
    elsif params[:remove_image] == 'true'
      @event.image = nil
    end

    was_invite_only = @event.invite_only?
    @event.update!(event_params)
    sync_post_with_invite_only!(was_invite_only)

    @event.update!(huddle_url: "https://#{Rails.configuration.x.kronk_jitsi_domain}/huddle") if @event.event_type_huddle? && @event.huddle_url.blank?

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
      return render json: { error: 'rsvp_closed' }, status: 422 unless @event.rsvp_enabled?

      # Counted and saved under the event's lock, so two people taking the
      # last place at once can't both get it.
      full = false
      @event.with_lock do
        # A new RSVP defaults to going, so ask whether it was going before.
        already_going = rsvp.persisted? && rsvp.status_going?
        full = params[:status] == 'going' && !already_going && event_full?
        next if full

        rsvp.status = params[:status]
        rsvp.save!
      end
      return render json: { error: 'event_full' }, status: 422 if full
    end

    render json: @event, serializer: REST::EventSerializer
  end

  def attendees
    @rsvps = @event.rsvps.includes(:account)
    @rsvps = @rsvps.where(status: params[:status]) if params[:status].present?
    @rsvps = @rsvps.where.not(account_id: Block.where(target_account_id: current_account.id).select(:account_id))
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

  # `params[:id]` may arrive as a numeric id (legacy `/hub/kalendar/12345`
  # URLs — bookmarks, embed frames, older invitation nudges) or as a
  # slug (post-2026-08-14 URLs like `/hub/kalendar/cold-plunge`).
  # Numeric strings resolve by id; anything else resolves by the
  # unique `slug` column. Rejects an unknown identifier with the
  # standard ActiveRecord::RecordNotFound so the controller returns
  # 404 without leaking whether the row existed under a different
  # scheme.
  def set_event
    @event = Event.by_link!(params[:id])
  end

  def authorize_event_owner!
    raise Mastodon::NotPermittedError unless @event.account_id == current_account.id
  end

  # Read gate for `show` / `attendees` / `rsvp`. `visible_to?` is the
  # single source of truth (author + invitees + Status reach when
  # not invite_only) — see Event#visible_to? for the rule. Not found, not
  # forbidden: a guessed name must not tell anyone a hidden event exists.
  def authorize_event_visible!
    raise ActiveRecord::RecordNotFound unless @event.visible_to?(current_account)
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

  # The events of one Krew: those whose audience includes it.
  def for_krew(scope)
    scope.where(status_id: Status.joins(:krews).where(krews: { id: params[:krew_id] }).select(:id))
  end

  def filtered_events
    scope = Event.not_cancelled.root_events

    case params[:filter]
    when 'past'
      scope.past
    when 'mine'
      mine_when(scope.where(account: current_account))
    when 'invited'
      scope.joins(:invitations).where(event_invitations: { account: current_account })
    else
      scope.upcoming
    end
  end

  # `filter=mine` alone is every event you made, in no set order. `when`
  # narrows it to those coming up (soonest first) or those started already
  # (most recent first), so a picker isn't left sorting a capped page.
  def mine_when(scope)
    case params[:when]
    when 'upcoming' then scope.upcoming
    when 'past' then scope.past
    else scope
    end
  end

  # An event's post follows invite-only. Turning it on takes the post out of
  # every feed (an invite-only event is for its invitees, not followers);
  # turning it off posts it at the reach asked for.
  def sync_post_with_invite_only!(was_invite_only)
    return if was_invite_only == @event.invite_only?

    if @event.status.present?
      RemoveStatusService.new.call(@event.status)
      @event.update!(status: nil)
    end
    create_status_for_event!(@event) unless @event.invite_only?
  end

  def event_full?
    @event.max_attendees.present? && @event.rsvps.status_going.count >= @event.max_attendees
  end

  # Off only when the client says so; a form post sends the string.
  def post_to_feed?
    params[:post_to_feed] != false && params[:post_to_feed] != 'false'
  end

  # The reach the event's post and spawned album get. An event that isn't
  # posted is seen only by its author and invitees (Event#visible_to?), so
  # its album is Just me too, or the album would carry its title out.
  def event_reach(event)
    return 'self_only' if event.invite_only? || !post_to_feed?

    params[:visibility] || current_account.user&.setting_default_privacy || 'public'
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
    visibility = event_reach(event)

    # Krew is an additive audience axis (docs/spaces/feed.md (Krew is a separate axis)):
    # a post carries exactly one reach tier AND, independently, any set
    # of krews — the two are not alternatives. Members of the targeted
    # krews see the event on top of whatever the reach picks up.
    # Silently dropped on invite_only events since fan-out is disabled
    # for `self_only` visibility anyway.
    krew_ids = Array(params[:krew_ids]).map(&:to_i).reject(&:zero?).uniq

    @status = PostStatusService.new.call(
      current_account,
      text: status_text,
      visibility: visibility,
      krew_ids: krew_ids,
      application: doorkeeper_token.application
    )

    event.update!(status: @status)
    @status.update_column(:source_korner, 'kalendar') # feed projection discriminator (§3.2)
    @status.touch
  end
end
