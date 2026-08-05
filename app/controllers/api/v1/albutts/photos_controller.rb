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
    # Diagnostic failure surfaces — each denial path now returns a
    # specific `error` string in the JSON body (was previously the
    # generic "This action is not allowed" for every 403 via the
    # base controller's blanket NotPermittedError handler). The
    # composer's UI extracts and displays the message so the
    # contributor knows WHY the upload was rejected.
    unless @album.contributable_by?(current_account)
      Rails.logger.info(
        "[albutts] contribute rejected — album_id=#{@album.id} scope=#{@album.visibility} " \
        "owner_id=#{@album.owner_id} contributor_id=#{current_account.id}"
      )
      render json: { error: contribution_denial_reason }, status: 403
      return
    end

    permitted = photo_params
    media_id = permitted[:media_id]
    raise Mastodon::UnprocessableEntityError, 'media_id is required' if media_id.blank?

    media = MediaAttachment.find(media_id)
    raise Mastodon::UnprocessableEntityError, "media #{media_id} was uploaded by another account" unless media.account_id == current_account.id

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
  rescue Mastodon::ValidationError, ActiveRecord::RecordInvalid => e
    # ValidationError typically comes from PostStatusService (e.g.
    # media not yet processed, media_ids limit, unexpected mentions).
    # Log with context so we can trace whether it's a client-side race
    # (submitting before media processing finishes) or something else.
    Rails.logger.warn(
      "[albutts] contribute failed — album_id=#{@album.id} " \
      "contributor_id=#{current_account.id} media_id=#{media_id} " \
      "(#{e.class}): #{e.message}"
    )
    render json: { error: e.message }, status: 422
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

  # Human-readable reason the current account can't contribute to
  # this album. Contribution follows visibility (Album#contributable_by?
  # → visible_to?), so a rejection here maps 1:1 with a scope
  # exclusion. Named scopes get named messages so the contributor
  # knows what to do (become a Mate, be added to the Krew, etc.)
  # rather than "This action is not allowed".
  # Diagnostic API error strings — not user-visible chrome, and
  # locale-agnostic diagnostic messaging is intentional for now
  # (they surface WHY an upload was rejected in dev-tools + the
  # contribute composer's per-pick error row). Move to I18n if we
  # start localising the composer's error surface.
  # rubocop:disable I18n/RailsI18n/DecorateString
  def contribution_denial_reason
    case @album.visibility
    when 'self_only'
      "This album is owner-only — only #{@album.owner.acct} can add photos."
    when 'mates'
      "This album is only open to #{@album.owner.acct}'s Mates. Ask them to Mate you if you'd like to contribute."
    when 'orbit'
      "This album is only open to #{@album.owner.acct}'s Orbit."
    when 'krew'
      "This album is only open to specific Krews — you're not in one of them."
    else
      "You can't contribute to this album."
    end
  end
  # rubocop:enable I18n/RailsI18n/DecorateString
end
