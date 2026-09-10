# frozen_string_literal: true

# Art — photos of a single piece. All photos of a piece are by the
# piece's owner, so the auth rule is simple: only the owner may
# add / update / delete photos. No separate contribution roster (unlike
# Albutts).
class Api::V1::Art::PhotosController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_piece, only: [:create]
  before_action :set_photo, only: [:update, :destroy]

  def create
    authorize_owner_of!(@piece)

    permitted = photo_params
    media_id  = permitted[:media_id]
    raise Mastodon::UnprocessableEntityError, 'media_id is required' if media_id.blank?

    media = MediaAttachment.find(media_id)
    raise Mastodon::UnprocessableEntityError, "media #{media_id} was uploaded by another account" unless media.account_id == current_account.id

    # Position appends to the end unless the caller supplies one. Using
    # (max + 1) rather than photos.count keeps ordering stable if a
    # middle row is deleted and then a new one is added.
    next_position = permitted[:position].presence || ((@piece.photos.maximum(:position) || -1) + 1)

    @photo = @piece.photos.create!(
      media_attachment: media,
      caption: permitted[:caption].to_s,
      position: next_position
    )

    render json: @photo, serializer: REST::ArtPiecePhotoSerializer, status: 201
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def update
    authorize_owner_of!(@photo.art_piece)

    if @photo.update(update_params)
      render json: @photo.reload, serializer: REST::ArtPiecePhotoSerializer
    else
      render json: { error: @photo.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner_of!(@photo.art_piece)
    @photo.destroy!
    render_empty
  end

  private

  def set_piece
    @piece = ArtPiece.find(params[:art_piece_id])
  end

  def set_photo
    @photo = ArtPiecePhoto.find(params[:id])
  end

  def photo_params
    params.expect(photo: [:caption, :media_id, :position])
  end

  def update_params
    params.expect(photo: [:caption, :position])
  end

  def authorize_owner_of!(piece)
    raise Mastodon::NotPermittedError unless piece.owner_id == current_account.id
  end
end
