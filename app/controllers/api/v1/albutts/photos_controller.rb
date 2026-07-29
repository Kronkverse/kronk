# frozen_string_literal: true

# Albutts — contributions to an album. One row per photo. Anyone who
# can view the album can also contribute (open-roster within scope;
# see docs/spaces/albutts.md §Visibility scopes). Deleting a photo is
# limited to the contributor themselves or the album's owner.
class Api::V1::Albutts::PhotosController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_album,  only: [:create]
  before_action :set_photo,  only: [:destroy]

  def create
    raise Mastodon::NotPermittedError unless @album.contributable_by?(current_account)

    @photo = @album.photos.new(photo_params.merge(contributor: current_account))
    attach_media! if params[:media_id].present?

    if @photo.save
      render json: @photo, serializer: REST::AlbumPhotoSerializer, status: 201
    else
      render json: { error: @photo.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    raise Mastodon::NotPermittedError unless @photo.contributor_id == current_account.id ||
                                             @photo.album.owner_id == current_account.id

    @photo.destroy!
    render_empty
  end

  private

  def set_album
    @album = Album.find(params[:album_id])
  end

  def set_photo
    @photo = AlbumPhoto.find(params[:id])
  end

  # `media_id` — a MediaAttachment the contributor already uploaded
  # (via Mastodon's `POST /api/v1/media`). The attachment must belong
  # to the caller; the model's validation enforces that at write time,
  # and this controller step just resolves the id.
  def attach_media!
    ma = MediaAttachment.find(params[:media_id])
    @photo.media_attachment = ma
  end

  def photo_params
    params.expect(photo: [:caption, :external_url])
  end
end
