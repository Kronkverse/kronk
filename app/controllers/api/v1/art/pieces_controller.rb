# frozen_string_literal: true

# Art — single-author works of a physical nature (paintings,
# sculptures, prints, drawings, ceramics, photographs of works). REST
# for the piece itself; photos of the piece live in the nested
# PhotosController.
#
# Visibility gating happens at query time via
# `ArtPiece.visible_to(viewer)`; per-action authorisation (update /
# destroy) requires the caller be the owner.
class Api::V1::Art::PiecesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!, except: [:index, :show]
  before_action :set_piece,     only: [:show, :update, :destroy]

  DEFAULT_LIMIT = 24
  MAX_LIMIT     = 60

  # Faces of the `<ScopeTitle>` rotator on /hub/art. `all` is every
  # piece the viewer can see; the others narrow that set. Unknown
  # values fall back to `all` so a stale URL segment can't 404.
  SCOPES = %w(all mine mates).freeze

  def index
    scope = ArtPiece.visible_to(current_account).recent
    scope = narrow_by_scope(scope)
    render json: scope.limit(clamp_limit), each_serializer: REST::ArtPieceSerializer
  end

  def show
    raise Mastodon::NotPermittedError unless @piece.visible_to?(current_account)

    render json: @piece, serializer: REST::ArtPieceSerializer
  end

  def create
    @piece = current_account.owned_art_pieces.new(piece_params)

    if @piece.save
      Art::PublishPiece.new(@piece).call
      render json: @piece.reload, serializer: REST::ArtPieceSerializer, status: 201
    else
      render json: { error: @piece.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!

    if @piece.update(piece_params)
      render json: @piece.reload, serializer: REST::ArtPieceSerializer
    else
      render json: { error: @piece.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner!
    @piece.destroy!
    render_empty
  end

  private

  def set_piece
    @piece = ArtPiece.find(params[:id])
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end

  # Filter the base `visible_to` relation to the requested scope.
  # `mine` / `mates` require a signed-in caller — for an unauthenticated
  # request they degrade to `all` so the frontend can share one code
  # path across states.
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

  def piece_params
    params.expect(art_piece: [:title, :description, :kind, :visibility, :cover_media_attachment_id])
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @piece.owner_id == current_account.id
  end
end
