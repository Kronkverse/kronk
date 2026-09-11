# frozen_string_literal: true

# Cinema — single-author short films. The film's video is a
# MediaAttachment uploaded via the shared `POST /api/v1/media` pipeline
# and referenced by id when creating the film. No per-shot subresources
# in v1.
#
# Visibility gating at query time via `Film.visible_to(viewer)`; per-
# action authorisation (update / destroy) requires the caller be the
# owner.
class Api::V1::Cinema::FilmsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!, except: [:index, :show]
  before_action :set_film,      only: [:show, :update, :destroy]

  DEFAULT_LIMIT = 24
  MAX_LIMIT     = 60

  SCOPES = %w(all mine mates).freeze

  def index
    scope = Film.visible_to(current_account).recent
    scope = narrow_by_scope(scope)
    render json: scope.limit(clamp_limit), each_serializer: REST::FilmSerializer
  end

  def show
    raise Mastodon::NotPermittedError unless @film.visible_to?(current_account)

    render json: @film, serializer: REST::FilmSerializer
  end

  def create
    media_id = params.dig(:film, :video_media_attachment_id).presence
    raise Mastodon::UnprocessableEntityError, 'video_media_attachment_id is required' if media_id.blank?

    media = MediaAttachment.find(media_id)
    raise Mastodon::UnprocessableEntityError, "media #{media_id} was uploaded by another account" unless media.account_id == current_account.id

    @film = current_account.owned_films.new(film_params)

    if @film.save
      Cinema::PublishFilm.new(@film).call
      render json: @film.reload, serializer: REST::FilmSerializer, status: 201
    else
      render json: { error: @film.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!

    if @film.update(film_params_for_update)
      render json: @film.reload, serializer: REST::FilmSerializer
    else
      render json: { error: @film.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner!
    @film.destroy!
    render_empty
  end

  private

  def set_film
    @film = Film.find(params[:id])
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end

  def narrow_by_scope(relation)
    requested = params[:scope].to_s.presence_in(SCOPES) || 'all'
    return relation if current_account.nil? || requested == 'all'

    case requested
    when 'mine'
      relation.where(owner_id: current_account.id)
    when 'mates'
      relation.where(owner_id: current_account.mates.select(:id))
    else
      relation
    end
  end

  def film_params
    params.expect(film: [:title, :description, :visibility, :video_media_attachment_id])
  end

  # Video is set once at create — updates change the metadata only.
  # Rewinding to a new video would be a full re-post.
  def film_params_for_update
    params.expect(film: [:title, :description, :visibility])
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @film.owner_id == current_account.id
  end
end
