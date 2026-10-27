# frozen_string_literal: true

# A Series' chapters (docs/spaces/kronikles.md, Series). Reading lists only
# the chapters the viewer can see, in reading order. Its owner adds one of
# their own Kronikles (it goes last, and leaves any Series it was in) or
# takes one out (the Kronikle stays). Writes answer with the owner's full
# list, so the page can redraw from it.
class Api::V1::Kronikles::SeriesChaptersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!, except: [:index]
  before_action :set_series
  before_action :authorize_owner!, except: [:index]

  def index
    render_chapters(@series.chapters_visible_to(current_account))
  end

  def create
    chronicle = current_account.owned_chronicles.find(params[:chronicle_id])
    chronicle.update!(series: @series) unless chronicle.series_id == @series.id
    render_chapters(@series.chapters)
  end

  def destroy
    chronicle = @series.chapters.find(params[:id])
    chronicle.update!(series: nil)
    render_chapters(@series.chapters)
  end

  private

  def set_series
    @series = ChronicleSeries.find(params[:series_id])
    raise ActiveRecord::RecordNotFound unless @series.visible_to?(current_account)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @series.owner_id == current_account.id
  end

  def render_chapters(relation)
    render json: relation.includes(:owner), each_serializer: REST::ChronicleSummarySerializer
  end
end
