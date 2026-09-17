# frozen_string_literal: true

# Karporn — photos of a single kar. Owner-only (single-author korner).
class Api::V1::Karporn::PhotosController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_kar,   only: [:create]
  before_action :set_photo, only: [:update, :destroy]

  def create
    authorize_owner_of!(@kar)

    permitted = photo_params
    media_id  = permitted[:media_id]
    raise Mastodon::UnprocessableEntityError, 'media_id is required' if media_id.blank?

    media = MediaAttachment.find(media_id)
    raise Mastodon::UnprocessableEntityError, "media #{media_id} was uploaded by another account" unless media.account_id == current_account.id

    next_position = permitted[:position].presence || ((@kar.photos.maximum(:position) || -1) + 1)

    @photo = @kar.photos.create!(
      media_attachment: media,
      caption: permitted[:caption].to_s,
      position: next_position
    )

    render json: @photo, serializer: REST::KarPhotoSerializer, status: 201
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def update
    authorize_owner_of!(@photo.kar)

    if @photo.update(update_params)
      render json: @photo.reload, serializer: REST::KarPhotoSerializer
    else
      render json: { error: @photo.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner_of!(@photo.kar)
    @photo.destroy!
    render_empty
  end

  private

  def set_kar
    @kar = Kar.find(params[:kar_id])
  end

  def set_photo
    @photo = KarPhoto.find(params[:id])
  end

  def photo_params
    params.expect(photo: [:caption, :media_id, :position])
  end

  def update_params
    params.expect(photo: [:caption, :position])
  end

  def authorize_owner_of!(kar)
    raise Mastodon::NotPermittedError unless kar.owner_id == current_account.id
  end
end
