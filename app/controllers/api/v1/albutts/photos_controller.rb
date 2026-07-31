# frozen_string_literal: true

# Albutts — contributions to an album. One row per photo, and each row
# is a thin join between the album and a `Status` that carries the
# caption, media, favourites, and reply thread. Deleting a photo is
# limited to the contributor themselves or the album's owner; the same
# rule guards a caption edit.
class Api::V1::Albutts::PhotosController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_album,  only: [:create]
  before_action :set_photo,  only: [:update, :destroy]

  def create
    raise Mastodon::NotPermittedError unless @album.contributable_by?(current_account)

    permitted = photo_params
    media_id = permitted[:media_id]
    raise Mastodon::UnprocessableEntityError, 'media_id is required' if media_id.blank?

    media = MediaAttachment.find(media_id)
    raise Mastodon::UnprocessableEntityError, 'media must belong to the contributor' unless media.account_id == current_account.id

    status = Albutts::PublishPhoto.new(
      album: @album,
      contributor: current_account,
      media_attachment: media,
      caption: permitted[:caption]
    ).call

    @photo = @album.photos.create!(
      contributor: current_account,
      status: status
    )

    render json: @photo, serializer: REST::AlbumPhotoSerializer, status: 201
  end

  # Caption edit — same authorization rule as `destroy` (contributor or
  # album owner). The write hits the backing Status so hashtag /
  # mention parsing and edit history run through the standard path.
  def update
    raise Mastodon::NotPermittedError unless editable_by_current_account?

    UpdateStatusService.new.call(
      @photo.status,
      current_account.id,
      text: update_params[:caption].to_s
    )

    render json: @photo.reload, serializer: REST::AlbumPhotoSerializer
  end

  def destroy
    raise Mastodon::NotPermittedError unless editable_by_current_account?

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

  def photo_params
    params.expect(photo: [:caption, :media_id])
  end

  def update_params
    params.expect(photo: [:caption])
  end

  def editable_by_current_account?
    @photo.contributor_id == current_account.id ||
      @photo.album.owner_id == current_account.id
  end
end
