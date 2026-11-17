# frozen_string_literal: true

# Samples in the Booth (docs/spaces/booth.md, Samples): share one, browse
# them, edit or delete your own. Every member sees every sample, as with
# sets, except where the maker has blocked them. Downloading is the web
# route `BoothController#download_sample`, which checks the terms.
class Api::V1::BoothSamplesController < Api::BaseController
  PAGE_SIZE = 40

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index, :show]
  before_action :require_user!
  before_action :set_sample, except: [:index, :create]

  def index
    samples = listing_scope.includes(:account, :audio_attachment, :pack).recent.limit(PAGE_SIZE)
    samples = samples.where(id: ...params[:max_id].to_i) if params[:max_id].present?
    samples = samples.where(sample_type: params[:type].to_s) if params[:type].present?
    samples = samples.where('? = ANY (booth_samples.vibes)', params[:vibe].to_s) if params[:vibe].present?
    samples = samples.where(account_id: params[:account_id]) if params[:account_id].present?
    samples = search(samples, params[:q]) if params[:q].present?
    render json: samples, each_serializer: REST::BoothSampleSerializer, granted_ids: granted_ids(samples)
  end

  def show
    render json: @sample, serializer: REST::BoothSampleSerializer, detail: true
  end

  def create
    sample = current_account.booth_samples.new(sample_params)
    sample.audio_attachment = current_account.media_attachments.find(params[:audio_id])
    sample.pack = current_account.booth_sample_packs.find(params[:pack_id]) if params[:pack_id].present?
    sample.duration_seconds = BoothSetTrack.media_duration(sample.audio_attachment) || submitted_duration
    sample.save!
    render json: sample, serializer: REST::BoothSampleSerializer, detail: true
  end

  def update
    authorize_owner!
    @sample.update!(sample_params)
    render json: @sample, serializer: REST::BoothSampleSerializer, detail: true
  end

  def destroy
    authorize_owner!
    @sample.destroy!
    render_empty
  end

  private

  # Everyone's samples, or only the ones you may use (`usable`, for a set's
  # Samples used): your own, the free ones and the ones you were given.
  def listing_scope
    scope = BoothSample.where.not(account_id: Block.where(target_account_id: current_account.id).select(:account_id))
    return scope unless truthy?(params[:usable])

    scope.where(account_id: current_account.id)
         .or(scope.where(terms: 'free'))
         .or(scope.where(id: BoothSampleRequest.where(account_id: current_account.id, state: 'yes').select(:booth_sample_id)))
  end

  def search(scope, query)
    pattern = "%#{BoothSample.sanitize_sql_like(query.to_s.squish.first(100))}%"
    scope.where('booth_samples.title ILIKE :q OR booth_samples.genre ILIKE :q', q: pattern)
  end

  # The ask-first samples on the page the viewer was given. One query.
  def granted_ids(samples)
    BoothSampleRequest.where(account_id: current_account.id, state: 'yes', booth_sample_id: samples.map(&:id)).pluck(:booth_sample_id).to_set
  end

  # How long the file is, as the browser read it before uploading, for
  # when media processing hasn't (yet).
  def submitted_duration
    params[:duration_seconds].to_i.positive? ? params[:duration_seconds].to_i : nil
  end

  def set_sample
    @sample = BoothSample.find(params[:id])
    raise ActiveRecord::RecordNotFound if @sample.account.blocking?(current_account)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @sample.account_id == current_account.id || current_user.role&.can?(:manage_reports)
  end

  def truthy?(value)
    ActiveModel::Type::Boolean.new.cast(value) == true
  end

  def sample_params
    permitted = params.permit(:title, :sample_type, :musical_key, :bpm, :genre, :terms, vibes: [])
    permitted[:title] = permitted[:title].to_s.squish if permitted.key?(:title)
    %i(musical_key genre).each { |key| permitted[key] = permitted[key].to_s.squish.presence if permitted.key?(key) }
    permitted[:bpm] = permitted[:bpm].presence if permitted.key?(:bpm)
    permitted
  end
end
