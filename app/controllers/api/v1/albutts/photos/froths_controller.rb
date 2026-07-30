# frozen_string_literal: true

# Per-photo Froth toggle. Anyone who can view the photo's album can
# Froth (open-audience within scope, matching Albutts's contribution
# semantics). Idempotent: a double-POST does not create duplicate
# rows — the DB unique index catches it and we rescue gracefully.
class Api::V1::Albutts::Photos::FrothsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:favourites' }
  before_action :require_user!
  before_action :set_photo
  before_action :authorize_view!

  def create
    @photo.froths.find_or_create_by!(account: current_account)
    render json: @photo, serializer: REST::AlbumPhotoSerializer  rescue ActiveRecord::RecordNotUnique
    # Race between two clicks — the row exists; treat as success.
    render json: @photo, serializer: REST::AlbumPhotoSerializer  end

  def destroy
    froth = @photo.froths.find_by(account: current_account)
    froth&.destroy!
    render json: @photo, serializer: REST::AlbumPhotoSerializer  end

  private

  def set_photo
    @photo = AlbumPhoto.find(params[:photo_id])
  end

  def authorize_view!
    raise Mastodon::NotPermittedError unless @photo.album.visible_to?(current_account)
  end
end
