# frozen_string_literal: true

# Sample packs (docs/spaces/booth.md, Samples): samples grouped under one
# title and cover, like an album's tracks. Made first, then each sample is
# shared into it (`pack_id` on `POST /api/v1/booth_samples`).
class Api::V1::BoothSamplePacksController < Api::BaseController
  PAGE_SIZE = 40

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index, :show]
  before_action :require_user!
  before_action :set_pack, except: [:index, :create]

  def index
    packs = BoothSamplePack.where.not(account_id: Block.where(target_account_id: current_account.id).select(:account_id))
                           .where(id: BoothSample.select(:booth_sample_pack_id))
                           .includes(:account, :cover_attachment, samples: :audio_attachment)
                           .recent.limit(PAGE_SIZE)
    packs = packs.where(account_id: params[:account_id]) if params[:account_id].present?
    render json: packs, each_serializer: REST::BoothSamplePackSerializer
  end

  def show
    render json: @pack, serializer: REST::BoothSamplePackSerializer, detail: true
  end

  def create
    pack = current_account.booth_sample_packs.new(pack_params)
    pack.cover_attachment = current_account.media_attachments.find(params[:cover_id]) if params[:cover_id].present?
    pack.save!
    render json: pack, serializer: REST::BoothSamplePackSerializer, detail: true
  end

  def update
    authorize_owner!
    @pack.assign_attributes(pack_params)
    @pack.cover_attachment = current_account.media_attachments.find(params[:cover_id]) if params[:cover_id].present?
    @pack.save!
    render json: @pack, serializer: REST::BoothSamplePackSerializer, detail: true
  end

  def destroy
    authorize_owner!
    @pack.destroy!
    render_empty
  end

  private

  def set_pack
    @pack = BoothSamplePack.find(params[:id])
    raise ActiveRecord::RecordNotFound if @pack.account.blocking?(current_account)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @pack.account_id == current_account.id || current_user.role&.can?(:manage_reports)
  end

  def pack_params
    params.permit(:title, :description)
  end
end
