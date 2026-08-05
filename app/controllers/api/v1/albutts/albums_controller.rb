# frozen_string_literal: true

# Albutts — shared-album korner REST. This slice covers CRUD on the
# album itself; contributions live in the nested PhotosController.
#
# Visibility gating happens at query time via `Album.visible_to(viewer)`;
# per-action authorisation (`update` / `destroy`) requires the caller be
# the owner.
class Api::V1::Albutts::AlbumsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!, except: [:index, :show]
  before_action :set_album,     only: [:show, :update, :destroy]

  DEFAULT_LIMIT = 24
  MAX_LIMIT     = 60

  def index
    scope = Album.visible_to(current_account).recent.limit(clamp_limit)
    render json: scope, each_serializer: REST::AlbumSerializer
  end

  def show
    raise Mastodon::NotPermittedError unless @album.visible_to?(current_account)

    render json: @album, serializer: REST::AlbumSerializer
  end

  def create
    @album = current_account.owned_albums.new(album_params_for_create)
    attach_krews! if krew_ids_param.any?

    if @album.save
      Albutts::PublishAlbum.new(@album).call
      render json: @album.reload, serializer: REST::AlbumSerializer, status: 201
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!

    if @album.update(album_params_for_update)
      attach_krews! if params.key?(:krew_ids)
      render json: @album, serializer: REST::AlbumSerializer
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner!
    @album.destroy!
    render_empty
  end

  private

  def set_album
    @album = Album.find(params[:id])
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end

  def album_params_for_create
    params.expect(album: [:title, :description, :visibility, :contribution, :cover_media_attachment_id])
  end

  def album_params_for_update
    params.expect(album: [:title, :description, :visibility, :contribution, :cover_media_attachment_id])
  end

  def krew_ids_param
    Array(params[:krew_ids]).map(&:to_i).reject(&:zero?).uniq
  end

  # Sync the krew_ids set. On create this seeds the join table; on
  # update it replaces the set wholesale (removing any krews no longer
  # in the list). Only meaningful when visibility is `krew`; the model
  # validation catches the empty-krews case.
  def attach_krews!
    krew_ids = krew_ids_param
    return if krew_ids.empty? && @album.krew_scope?

    @album.album_krews.where.not(krew_id: krew_ids).destroy_all
    existing = @album.album_krews.pluck(:krew_id)
    (krew_ids - existing).each { |kid| @album.album_krews.create!(krew_id: kid) }
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @album.owner_id == current_account.id
  end
end
