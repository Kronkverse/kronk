# frozen_string_literal: true

# Karporn — single-author car posts (photos + year/make/model + optional
# location). Photos live in the nested PhotosController; the kar itself
# holds the metadata and (optionally) a lat/lng pin.
class Api::V1::Karporn::KarsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!, except: [:index, :show]
  before_action :set_kar,       only: [:show, :update, :destroy]

  DEFAULT_LIMIT = 24
  MAX_LIMIT     = 60

  SCOPES = %w(all mine mates).freeze

  def index
    scope = Kar.visible_to(current_account).recent
    scope = narrow_by_scope(scope)
    render json: scope.limit(clamp_limit), each_serializer: REST::KarSerializer
  end

  def show
    raise Mastodon::NotPermittedError unless @kar.visible_to?(current_account)

    render json: @kar, serializer: REST::KarSerializer
  end

  def create
    @kar = current_account.owned_kars.new(kar_params)

    if @kar.save
      Karporn::PublishKar.new(@kar).call
      render json: @kar.reload, serializer: REST::KarSerializer, status: 201
    else
      render json: { error: @kar.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!

    if @kar.update(kar_params)
      render json: @kar.reload, serializer: REST::KarSerializer
    else
      render json: { error: @kar.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner!
    @kar.destroy!
    render_empty
  end

  private

  def set_kar
    @kar = Kar.find(params[:id])
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

  def kar_params
    params.expect(kar: [:title, :description, :year, :make, :model, :visibility, :cover_media_attachment_id, :location_lat, :location_lng, :location_label])
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @kar.owner_id == current_account.id
  end
end
