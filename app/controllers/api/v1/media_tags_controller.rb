# frozen_string_literal: true

class Api::V1::MediaTagsController < Api::BaseController
  before_action :require_user!
  before_action :set_media_attachment

  def index
    render json: @media_attachment.media_tags.includes(:account),
           each_serializer: REST::MediaTagSerializer
  end

  def create
    is_self_tag = params[:account_id].to_s == current_account.id.to_s

    # Uploaders can tag anyone; everyone else can only tag themselves on public/unlisted media
    if is_self_tag
      unless @media_attachment.account_id == current_account.id
        status = @media_attachment.status
        return render json: { error: 'Forbidden' }, status: 403 unless status.present? && %w(public unlisted).include?(status.visibility)
      end
    else
      return render json: { error: 'Forbidden' }, status: 403 unless @media_attachment.account_id == current_account.id
    end

    tag = @media_attachment.media_tags.create!(
      account_id: params[:account_id],
      created_by_account: current_account,
      x: params.fetch(:x, 0.5).to_f.clamp(0.0, 1.0),
      y: params.fetch(:y, 0.5).to_f.clamp(0.0, 1.0)
    )

    NotifyService.new.call(tag.account, :media_tag, tag) if @media_attachment.status.present? && tag.account_id != current_account.id

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
