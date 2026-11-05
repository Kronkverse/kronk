# frozen_string_literal: true

# REST surface for KornerAttachment — the cross-korner join primitive
# (docs/korners/adding_a_korner.md (Korner attachments) §3.1).
#
#   GET    /api/v1/attachments?source=<slug>/<id>  — attachments where this
#                                                     record is the source
#   GET    /api/v1/attachments?target=<slug>/<id>  — target's-eye view
#   POST   /api/v1/attachments                     — user-added link/reference;
#                                                     `metadata: { audience: 'same' }`
#                                                     makes the source follow the
#                                                     target's audience
#   PATCH  /api/v1/attachments/:id                 — `audience_follows:
#                                                     'target' | 'source' | null`
#                                                     (or `audience: 'same' | null`)
#   GET    /api/v1/attachments/audience?korner=<slug>&id=<id>[&for=<slug>]
#                                                   — a would-be leader's audience
#   DELETE /api/v1/attachments/:id                 — undo either end
#
# A link you can't see (both ends) answers 404 on PATCH, as on index, so a
# guessed id reads nothing; changing it also needs you to look after one
# end. Two records are Konnected once: a link the other way round is
# refused (422, "Already Konnected").
#
# "Same as" (Kronk::Audience, decisions.md 2026-10-25): a link can say that
# one end's audience follows the other's. Only whoever looks after the
# follower sets or clears it, and only when the leader's audience can be
# followed; otherwise 422 with the reason.
#
# Phase 1 ships without a UI; internal API only. `spawn`-kind attachments
# are framework-only and land via factory in a later phase — POST here is
# for user-added `link` / `reference` rows.
class Api::V1::AttachmentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :audience]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!
  before_action :set_attachment, only: [:update, :destroy]

  def index
    scope = index_scope
    return render json: { error: 'source or target query is required' }, status: 422 unless scope

    rows = scope.includes(:created_by_account).order(created_at: :desc).limit(80).to_a
    KornerAttachment.preload_records(rows)
    # Who sees a Place at either end is read for the whole list at once.
    MapPlace.preload_konnections(rows.flat_map { |a| [a.source_record, a.target_record] }.grep(MapPlace).uniq)
    @attachments = rows.select { |a| KornerAttachmentPolicy.new(current_account, a).show? }
    audiences = Kronk::Audience.summaries(@attachments.flat_map { |a| [a.source_record, a.target_record] }, current_account)

    render json: @attachments, each_serializer: REST::KornerAttachmentSerializer, audiences: audiences
  end

  def create
    @attachment = KornerAttachment.new(attachment_params.merge(created_by_account: current_account))
    policy = KornerAttachmentPolicy.new(current_account, @attachment)
    return render json: { error: 'you do not own the source record' }, status: 403 unless policy.source_owned?
    # A target you can't see answers as if it weren't there, so a guessed
    # id says nothing about what exists.
    return render json: { error: 'not found' }, status: 404 unless policy.target_visible?
    return render json: { error: "kind '#{@attachment.kind}' cannot be created via the API" }, status: 422 if @attachment.kind == KornerAttachment::KIND_SPAWN
    # The unique index holds one direction; this holds both, so the same
    # two records aren't Konnected twice.
    return render json: { error: 'Already Konnected' }, status: 422 if already_konnected?

    follow = follow_requested?
    if follow
      error = follow_error('source')
      return render json: { error: error }, status: 422 if error
    end

    if @attachment.save
      Kronk::AttachmentEffects.linked(@attachment, current_account)
      Kronk::Audience.follow!(@attachment, 'source') if follow
      render json: @attachment, serializer: REST::KornerAttachmentSerializer
    else
      render json: { error: @attachment.errors.full_messages.first }, status: 422
    end
  end

  # Set or clear "Same as": which end leads (the other follows it). Only
  # for someone who looks after one end; anyone else gets 404 if they
  # can't see the link and 403 if they can. The link is sent back only to
  # someone who can see both ends: a follower's owner who has lost sight
  # of its leader can still stop following, and is told nothing of it.
  def update
    visible = KornerAttachmentPolicy.new(current_account, @attachment).show?
    unless looks_after?('source') || looks_after?('target')
      return render json: { error: 'attachment not found' }, status: 404 unless visible

      return render json: { error: 'only whoever looks after one of its ends can change a Konnection' }, status: 403
    end

    leader_end = requested_leader_end
    return render json: { error: 'audience_follows must be source, target or null' }, status: 422 if leader_end == :invalid

    if leader_end.nil?
      follower = @attachment.audience_follower
      return render_updated(visible) if follower.nil?
      return render json: { error: 'only whoever looks after the follower can stop it following' }, status: 403 unless looks_after?(follower)

      Kronk::Audience.unfollow!(@attachment)
    else
      follower = (Kronk::Audience::ENDS - [leader_end]).first
      return render json: { error: 'only whoever looks after a record can choose its audience' }, status: 403 unless looks_after?(follower)
      return render json: { error: 'not found' }, status: 404 unless Kronk::KornerRecords.visible?(end_record(leader_end), current_account)

      error = follow_error(follower)
      return render json: { error: error }, status: 422 if error

      Kronk::Audience.follow!(@attachment, follower)
    end
    render_updated(visible)
  end

  # What a composer shows before its record exists: the audience of a
  # record it could follow, and whether it can (for a record in `for`'s
  # korner, when given).
  def audience
    slug = params[:korner].to_s
    klass = Kronk::KornerRegistry.model_for(slug)
    record = klass&.find_by(id: params[:id].to_s)
    return render json: { error: 'not found' }, status: 404 unless Kronk::KornerRecords.visible?(record, current_account)

    summary = Kronk::Audience.summary(record, current_account) || { tier: nil, krews: [], hidden_krews: 0, followable: false }
    reason = audience_reason(record, summary)
    render json: summary.merge(followable: reason.nil?, reason: reason, title: Kronk::KornerRecords.title_of(record))
  end

  def destroy
    policy = KornerAttachmentPolicy.new(current_account, @attachment)
    # Someone who can neither remove it nor see it learns nothing of it.
    return render json: { error: 'attachment not found' }, status: 404 unless policy.destroy? || policy.show?
    return render json: { error: 'not authorised to remove this attachment' }, status: 403 unless policy.destroy?
    return render json: { error: "a Krew's own album or projekt stays linked to it" }, status: 422 unless Kronk::AttachmentEffects.removable?(@attachment)

    @attachment.destroy
    Kronk::AttachmentEffects.unlinked(@attachment)
    render_empty
  end

  private

  def set_attachment
    @attachment = KornerAttachment.find_by(id: params[:id])
    render json: { error: 'attachment not found' }, status: 404 unless @attachment
  end

  # Accepts `?source=<slug>/<id>` OR `?target=<slug>/<id>`. Returns nil
  # when neither (or both malformed) — the caller renders 422.
  def index_scope
    if params[:source].present?
      slug, id = parse_endpoint(params[:source])
      slug && id ? KornerAttachment.from_source(slug, id) : nil
    elsif params[:target].present?
      slug, id = parse_endpoint(params[:target])
      slug && id ? KornerAttachment.to_target(slug, id) : nil
    end
  end

  def parse_endpoint(raw)
    slug, id = raw.to_s.split('/', 2)
    return [nil, nil] if slug.blank? || id.blank?
    return [nil, nil] unless id.match?(/\A\d+\z/)

    [slug, id.to_i]
  end

  # Following is set through `audience`, never written into the metadata
  # directly, so it is always checked.
  def attachment_params
    permitted = params.permit(:source_slug, :source_id, :target_slug, :target_id, :kind, metadata: {}).to_h
    metadata = permitted.delete(:metadata)&.except('audience', Kronk::Audience::FOLLOWS_KEY)
    metadata.present? ? permitted.merge(metadata: metadata) : permitted
  end

  def render_updated(visible)
    return render_empty unless visible

    render json: @attachment, serializer: REST::KornerAttachmentSerializer
  end

  # Whether the two records already have a link of this kind, either way
  # round (Kronk::AttachmentEffects.between, for any kind).
  def already_konnected?
    a = @attachment
    links = KornerAttachment.where(kind: a.kind)
    links.where(source_slug: a.source_slug, source_id: a.source_id, target_slug: a.target_slug, target_id: a.target_id)
         .or(links.where(source_slug: a.target_slug, source_id: a.target_id, target_slug: a.source_slug, target_id: a.source_id))
         .exists?
  end

  def follow_requested?
    params.dig(:metadata, :audience).to_s == 'same'
  end

  def follow_error(follower_end)
    leader_end = (Kronk::Audience::ENDS - [follower_end]).first
    follower = end_record(follower_end)
    leader = end_record(leader_end)
    return 'a record follows the audience of something it is Konnected to' if follower.nil? || leader.nil? || @attachment.kind != KornerAttachment::KIND_LINK

    Kronk::Audience.follow_error(follower, leader)
  end

  # The record at one end of the link, by name ('source' or 'target'). Named
  # outright rather than sent as a method name built from the request.
  def end_record(end_name)
    case end_name
    when 'source' then @attachment.source_record
    when 'target' then @attachment.target_record
    end
  end

  # `audience_follows: 'target' | 'source' | null`, or the shortcut
  # `audience: 'same' | null` (the end you look after follows the other;
  # the source when you look after both).
  def requested_leader_end
    if params.key?(:audience_follows)
      value = params[:audience_follows].presence
      return nil if value.nil?

      Kronk::Audience::ENDS.include?(value.to_s) ? value.to_s : :invalid
    elsif params[:audience].to_s == 'same'
      looks_after?('source') || !looks_after?('target') ? 'target' : 'source'
    elsif params.key?(:audience) && params[:audience].blank?
      nil
    else
      :invalid
    end
  end

  def looks_after?(end_name)
    Kronk::KornerRecords.looked_after_by?(end_record(end_name), current_account)
  end

  # Why the composer's new record (in `for`'s korner, made by the viewer)
  # couldn't follow `record`, or nil: the same rules as Kronk::Audience.follow_error.
  def audience_reason(record, summary)
    return "#{params[:korner]} has no audience to follow" unless Kronk::Audience.supports?(params[:korner])
    return 'only an audience of Everyone or of Krews can be followed; Mates and Orbit belong to their owner' unless summary[:followable]
    return nil if params[:for].blank?

    follower_slug = params[:for].to_s
    adapter = Kronk::Audience.adapter(follower_slug)
    return "#{follower_slug} can't take another record's audience" if adapter.nil?
    return adapter.fixed_reason(nil) unless adapter.follows?
    return nil if summary[:tier] == 'public'
    return "#{follower_slug} can't be seen by a Krew, so it can't follow a Krew audience" unless adapter.krews?

    krew_ids = Kronk::Audience.read(record)[:krew_ids]
    "you're not in every Krew it's for" unless (krew_ids - Kronk::Audience.member_krew_ids(current_account.id)).empty?
  end
end
