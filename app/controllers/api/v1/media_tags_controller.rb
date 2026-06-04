# frozen_string_literal: true

class Api::V1::MediaTagsController < Api::BaseController
  include Authorization

  before_action :require_user!
  before_action :set_media_attachment

  def index
    render json: @media_attachment.media_tags.includes(:account),
           each_serializer: REST::MediaTagSerializer
  end

  def create
    tagged_account = Account.find_by(id: params[:account_id])
    return render json: { error: 'Account not found' }, status: 422 if tagged_account.nil?

    status = @media_attachment.status
    is_owner = @media_attachment.account_id == current_account.id

    # Public/unlisted posts: anyone can tag. Private/direct: owner only. Unattached media: owner only.
    if status.present?
      return render json: { error: 'Forbidden' }, status: 403 unless is_owner || %w(public unlisted).include?(status.visibility)
    else
      return render json: { error: 'Forbidden' }, status: 403 unless is_owner
    end

    return render json: { error: 'Already tagged' }, status: 422 if @media_attachment.media_tags.exists?(account_id: tagged_account.id)

    tag = @media_attachment.media_tags.create!(
      account: tagged_account,
      created_by_account: current_account,
      x: 0.5,
      y: 0.5
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
    @media_attachment = MediaAttachment.find(params[:medium_id])
  rescue ActiveRecord::RecordNotFound
    not_found
  end
end
