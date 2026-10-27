# frozen_string_literal: true

# Kronikles Series (docs/spaces/kronikles.md, Series): one writer's
# Kronikles as ordered chapters. Anyone may read a Series as far as they
# can see its chapters; one with no chapter they can see is a 404, the same
# as a Kronikle they can't see would be to them. Only its owner changes it.
# Chapters are added and taken out under /series/:series_id/chapters.
class Api::V1::Kronikles::SeriesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :reorder]
  before_action :require_user!, except: [:index, :show]
  before_action :set_series, only: [:show, :update, :destroy, :reorder]
  before_action :authorize_owner!, only: [:update, :destroy, :reorder]

  LIMIT = 60

  # The Series the viewer can see, recently changed first. `scope=mine`:
  # only their own (the composer's Series choice).
  def index
    scope = ChronicleSeries.visible_to(current_account)
    if params[:scope] == 'mine'
      scope = current_account ? scope.where(owner_id: current_account.id) : scope.none
    end
    scope = scope.includes(:owner, :cover_media_attachment).order(updated_at: :desc, id: :desc).limit(LIMIT)
    render json: scope, each_serializer: REST::ChronicleSeriesSerializer
  end

  def show
    render json: @series, serializer: REST::ChronicleSeriesSerializer
  end

  def create
    @series = current_account.owned_chronicle_series.new(series_params)

    if @series.save
      render json: @series, serializer: REST::ChronicleSeriesSerializer, status: 201
    else
      render json: { error: @series.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    if @series.update(series_params)
      render json: @series, serializer: REST::ChronicleSeriesSerializer
    else
      render json: { error: @series.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  # Its Kronikles stay, out of any Series.
  def destroy
    @series.destroy!
    render_empty
  end

  # PUT with `chapter_ids`: every chapter, once, in the new reading order.
  def reorder
    if @series.reorder_chapters!(params[:chapter_ids])
      render json: @series.chapters.includes(:owner), each_serializer: REST::ChronicleSummarySerializer
    else
      render json: { error: 'Name every chapter of the Series once.' }, status: :unprocessable_entity
    end
  end

  private

  def set_series
    @series = ChronicleSeries.find(params[:id])
    raise ActiveRecord::RecordNotFound unless @series.visible_to?(current_account)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @series.owner_id == current_account.id
  end

  def series_params
    params.expect(series: [:title, :description, :cover_media_attachment_id])
  end
end
