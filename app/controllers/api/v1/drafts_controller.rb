# frozen_string_literal: true

# Composer autosave — a single rolling draft per account. The web composer PUTs
# its state here (debounced) so work survives navigating away, a refresh, or a
# device switch; GET restores it on mount; DELETE clears it (also cleared on
# publish). One draft per account (unique index); PUT upserts.
#
#   GET    /api/v1/draft  => the current draft, or null
#   PUT    /api/v1/draft  => upsert (body: text, spoiler_text, visibility,
#                           language, in_reply_to_id, sensitive, poll, media_ids)
#   DELETE /api/v1/draft  => discard
class Api::V1::DraftsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:update, :destroy]
  before_action :require_user!

  def show
    draft = current_account.draft
    return render json: nil if draft.nil?

    render json: draft, serializer: REST::DraftSerializer
  end

  def update
    draft = current_account.draft || current_account.build_draft
    draft.params = draft_params
    draft.media_attachment_ids = sanitized_media_ids
    draft.save!

    render json: draft, serializer: REST::DraftSerializer
  end

  def destroy
    current_account.draft&.destroy!

    render json: nil
  end

  private

  def draft_params
    params.permit(
      :text, :spoiler_text, :visibility, :language, :in_reply_to_id, :sensitive,
      poll: [:multiple, :hide_totals, :expires_in, { options: [] }]
    ).to_h
  end

  # Only the account's own media, order preserved.
  def sanitized_media_ids
    requested = Array(params[:media_ids]).map(&:to_i).reject(&:zero?)
    return [] if requested.empty?

    owned = current_account.media_attachments.where(id: requested).pluck(:id).to_set
    requested.select { |id| owned.include?(id) }
  end
end
