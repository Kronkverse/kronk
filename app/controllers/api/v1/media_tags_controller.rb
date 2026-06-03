# frozen_string_literal: true

class Api::V1::MediaTagsController < Api::BaseController
  before_action :require_user!
  before_action :set_media_attachment

  def index
    render json: @media_attachment.media_tags.includes(:account),
           each_serializer: REST::MediaTagSerializer
  end

  def create
    status = @media_attachment.status

    if status.present?
      # Posted media — anyone can tag anyone as long as the post is public/unlisted
      return render json: { error: 'Forbidden' }, status: 403 unless %w(public unlisted).include?(status.visibility)
    else
      # Unposted (compose flow) — only the uploader can tag
      return render json: { error: 'Forbidden' }, status: 403 unless @media_attachment.account_id == current_account.id
    end

    tag = @media_attachment.media_tags.create!(
      account_id: params[:account_id],
      created_by_account: current_account,
      x: params.fetch(:x, 0.5).to_f.clamp(0.0, 1.0),
      y: params.fetch(:y, 0.5).to_f.clamp(0.0, 1.0)
    )

    NotifyService.new.call(tag.account, :media_tag, tag) if status.present? && tag.account_id != current_account.id

    render json: tag, serializer: REST::MediaTagSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.first }, status: 422
  end

  def destroy
    tag = @media_attachment.media_tags.find_by!(account_id: params[:id])
    authorize tag, :destroy?
    tag.destroy!
    head 200
  end

  private

  def set_media_attachment
    @media_attachment = MediaAttachment.find(params[:media_id])
  rescue ActiveRecord::RecordNotFound
    not_found
  end
end
