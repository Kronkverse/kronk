# frozen_string_literal: true

class Api::V1::BoothSetsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :play]
  before_action :require_user!, except: [:index, :show]
  before_action :set_booth_set, except: [:index, :create]

  def index
    @booth_sets = BoothSet.published
                          .includes(:account, :audio_attachment, :cover_attachment)
                          .recent
                          .limit(40)
    render json: @booth_sets, each_serializer: REST::BoothSetSerializer
  end

  def show
    raise ActiveRecord::RecordNotFound unless @booth_set.published? || owner?

    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def create
    @booth_set = current_account.booth_sets.new(booth_set_params)
    set_audio! if params[:audio_id].present?
    set_cover! if params[:cover_id].present?
    @booth_set.save!
    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def update
    authorize_owner!
    set_audio! if params[:audio_id].present?
    if params[:remove_cover] == 'true'
      @booth_set.cover_attachment = nil
    elsif params[:cover_id].present?
      set_cover!
    end
    @booth_set.update!(booth_set_params)
    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def destroy
    authorize_owner!
    @booth_set.destroy!
    render_empty
  end

  def play
    @booth_set.increment_play_count! if @booth_set.published?
    render_empty
  end

  private

  def set_booth_set
    @booth_set = BoothSet.find(params[:id])
  end

  def owner?
    current_account&.id == @booth_set.account_id
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless owner?
  end

  def set_audio!
    @booth_set.audio_attachment = current_account.media_attachments.find(params[:audio_id])
  end

  def set_cover!
    @booth_set.cover_attachment = current_account.media_attachments.find(params[:cover_id])
  end

  def booth_set_params
    params.permit(:title, :description, :artist_name, :event_name, :event_date,
                  :duration_seconds, :published, genres: [])
  end
end
