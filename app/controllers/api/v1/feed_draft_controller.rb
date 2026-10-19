# frozen_string_literal: true

# The post composer's rolling draft, from before every composer had drafts
# (Api::V1::DraftsController). It reads and writes the newest feed post draft
# with no context, so it and the drafts API see the same row. Goes once the
# post composer uses the drafts API.
#
#   GET    /api/v1/draft  => the current draft, or null
#   PUT    /api/v1/draft  => upsert (body: text, spoiler_text, visibility,
#                           language, in_reply_to_id, sensitive, poll, media_ids)
#   DELETE /api/v1/draft  => discard
class Api::V1::FeedDraftController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:update, :destroy]
  before_action :require_user!

  def show
    draft = feed_draft
    return render json: nil if draft.nil?

    render json: draft, serializer: REST::DraftSerializer
  end

  def update
    draft = feed_draft || current_account.drafts.new(korner: 'feed', kind: 'post')
    draft.params = draft_params
    draft.media_attachment_ids = sanitized_media_ids
    draft.save!

    render json: draft, serializer: REST::DraftSerializer
  end

  def destroy
    feed_draft&.destroy!

    render json: nil
  end

  private

  def feed_draft
    current_account.drafts.for_composer('feed', 'post').recent.first
  end

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
