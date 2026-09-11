# frozen_string_literal: true

# Kronikles — single-author long-form written works. REST for the
# chronicle itself; no nested resources (body + kind live on the
# chronicle row).
#
# Visibility gating at query time via
# `Chronicle.visible_to(viewer)`; per-action authorisation (update /
# destroy) requires the caller be the owner.
class Api::V1::Kronikles::ChroniclesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!, except: [:index, :show]
  before_action :set_chronicle, only: [:show, :update, :destroy]

  DEFAULT_LIMIT = 24
  MAX_LIMIT     = 60

  # Faces of the `<ScopeTitle>` rotator on /hub/kronikles. `all` is
  # every chronicle the viewer can see; the others narrow that set.
  # Unknown values fall back to `all` so a stale URL segment can't 404.
  SCOPES = %w(all mine mates).freeze

  def index
    scope = Chronicle.visible_to(current_account).recent
    scope = narrow_by_scope(scope)
    render json: scope.limit(clamp_limit), each_serializer: REST::ChronicleSerializer
  end

  def show
    raise Mastodon::NotPermittedError unless @chronicle.visible_to?(current_account)

    render json: @chronicle, serializer: REST::ChronicleSerializer
  end

  def create
    @chronicle = current_account.owned_chronicles.new(chronicle_params)

    if @chronicle.save
      Kronikles::PublishChronicle.new(@chronicle).call
      render json: @chronicle.reload, serializer: REST::ChronicleSerializer, status: 201
    else
      render json: { error: @chronicle.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!

    if @chronicle.update(chronicle_params)
      render json: @chronicle.reload, serializer: REST::ChronicleSerializer
    else
      render json: { error: @chronicle.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner!
    @chronicle.destroy!
    render_empty
  end

  private

  def set_chronicle
    @chronicle = Chronicle.find(params[:id])
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

  def chronicle_params
    params.expect(chronicle: [:title, :body, :kind, :visibility])
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @chronicle.owner_id == current_account.id
  end
end
