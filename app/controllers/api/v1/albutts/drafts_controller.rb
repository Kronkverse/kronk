# frozen_string_literal: true

# Album drafts (docs/spaces/albutts.md, Drafts): the album composer saves
# what you're putting together here as you go. Each draft is its owner's
# alone.
#
#   GET    /api/v1/albutts/drafts      => your drafts, newest first
#   POST   /api/v1/albutts/drafts      => start one
#   PUT    /api/v1/albutts/drafts/:id  => save it (the whole state)
#   DELETE /api/v1/albutts/drafts/:id  => discard it (also on create)
#
# Body: title, description, visibility, contribution_open, krew_ids,
# contributor_krew_ids, contributor_accounts (id, acct, display_name, so
# the picker can show names again), captions (media id => caption) and
# media_ids (uploads in album order). Only your own uploads are kept.
class Api::V1::Albutts::DraftsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!
  before_action :set_draft, only: [:update, :destroy]

  def index
    drafts = current_account.album_drafts.recent.limit(AlbumDraft::MAX_PER_ACCOUNT)
    render json: drafts, each_serializer: REST::AlbumDraftSerializer
  end

  def create
    draft = current_account.album_drafts.new
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
    @draft = current_account.album_drafts.find(params[:id])
  end

  def save_draft(draft)
    draft.params = draft_params
    draft.media_attachment_ids = owned_media_ids
    draft.save!

    render json: draft, serializer: REST::AlbumDraftSerializer
  end

  def draft_params
    params.permit(
      :title, :description, :visibility, :contribution_open,
      krew_ids: [], contributor_krew_ids: [], contributor_accounts: [:id, :acct, :display_name], captions: {}
    ).to_h
  end

  # Only the account's own uploads, in the order sent.
  def owned_media_ids
    requested = Array(params[:media_ids]).map(&:to_i).reject(&:zero?).uniq
    return [] if requested.empty?

    owned = current_account.media_attachments.where(id: requested).pluck(:id).to_set
    requested.select { |id| owned.include?(id) }
  end
end
