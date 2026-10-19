# frozen_string_literal: true

# Drafts for every composer (docs/design.md, Drafts). A composer saves what
# is being written here as it goes, and offers it back when it opens again,
# on any device. Each draft is its owner's alone; anyone else gets a 404.
#
#   GET    /api/v1/drafts?korner=&kind=&context=  => that composer's drafts, newest first
#   GET    /api/v1/drafts/:id                     => one draft
#   POST   /api/v1/drafts                         => start one
#   PUT    /api/v1/drafts/:id                     => save it (the whole state)
#   DELETE /api/v1/drafts/:id                     => discard it (also on posting)
#
# Body: korner, kind and context (on create only; a draft never changes
# composer), version, params (the composer's fields, an object) and
# media_ids (uploads in order; only your own are kept).
class Api::V1::DraftsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index, :show]
  before_action :require_user!
  before_action :set_draft, only: [:show, :update, :destroy]

  def index
    drafts = current_account.drafts
                            .for_composer(params.require(:korner), params.require(:kind), params[:context])
                            .recent
                            .limit(Draft::MAX_PER_COMPOSER)

    render json: drafts, each_serializer: REST::DraftSerializer
  end

  def show
    render json: @draft, serializer: REST::DraftSerializer
  end

  def create
    draft = current_account.drafts.new(
      korner: params.require(:korner),
      kind: params.require(:kind),
      context: params[:context].presence
    )
    save_draft(draft)
  end

  def update
    save_draft(@draft)
  end

  def destroy
    @draft.destroy!
    render_empty
  end

  private

  def set_draft
    @draft = current_account.drafts.find(params[:id])
  end

  def save_draft(draft)
    draft.version = params[:version].to_i if params[:version].present?
    draft.params = draft_params
    draft.media_attachment_ids = owned_media_ids
    draft.save!

    render json: draft, serializer: REST::DraftSerializer
  end

  # The composer's fields are its own business: whatever object it sends is
  # kept as sent, within Draft::MAX_PARAMS_BYTES. It is only ever read back
  # by its owner.
  def draft_params
    raw = params[:params]
    return {} if raw.nil?
    return raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)

    raw
  end

  # Only the account's own uploads, in the order sent.
  def owned_media_ids
    requested = Array(params[:media_ids]).map(&:to_i).reject(&:zero?).uniq
    return [] if requested.empty?

    owned = current_account.media_attachments.where(id: requested).pluck(:id).to_set
    requested.select { |id| owned.include?(id) }
  end
end
