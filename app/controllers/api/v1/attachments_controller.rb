# frozen_string_literal: true

# REST surface for KornerAttachment — the cross-korner join primitive
# (docs/kronk_korner_attachments.md §3.1).
#
#   GET    /api/v1/attachments?source=<slug>/<id>  — attachments where this
#                                                     record is the source
#   GET    /api/v1/attachments?target=<slug>/<id>  — target's-eye view
#   POST   /api/v1/attachments                     — user-added link/reference
#   DELETE /api/v1/attachments/:id                 — undo either end
#
# Phase 1 ships without a UI; internal API only. `spawn`-kind attachments
# are framework-only and land via factory in a later phase — POST here is
# for user-added `link` / `reference` rows.
class Api::V1::AttachmentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :set_attachment, only: [:destroy]

  def index
    scope = index_scope
    return render json: { error: 'source or target query is required' }, status: 422 unless scope

    @attachments = scope.includes(:created_by_account).order(created_at: :desc).limit(80).select do |a|
      KornerAttachmentPolicy.new(current_account, a).show?
    end

    render json: @attachments, each_serializer: REST::KornerAttachmentSerializer
  end

  def create
    @attachment = KornerAttachment.new(attachment_params.merge(created_by_account: current_account))
    return render json: { error: 'you do not own the source record' }, status: 403 unless KornerAttachmentPolicy.new(current_account, @attachment).create?
    return render json: { error: "kind '#{@attachment.kind}' cannot be created via the API" }, status: 422 if @attachment.kind == KornerAttachment::KIND_SPAWN

    if @attachment.save
      render json: @attachment, serializer: REST::KornerAttachmentSerializer
    else
      render json: { error: @attachment.errors.full_messages.first }, status: 422
    end
  end

  def destroy
    return render json: { error: 'not authorised to remove this attachment' }, status: 403 unless KornerAttachmentPolicy.new(current_account, @attachment).destroy?

    @attachment.destroy
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

  def attachment_params
    params.permit(:source_slug, :source_id, :target_slug, :target_id, :kind, metadata: {})
  end
end
