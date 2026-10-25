# frozen_string_literal: true

# Live sets in the Booth (docs/spaces/booth.md, Live sets). Members only:
# a live set carries its Jitsi room key, which is how you get in.
class Api::V1::BoothLivesController < Api::BaseController
  REACH = Api::V1::BoothSetsController::REACH

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :now, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index, :now, :show]
  before_action :require_user!
  before_action :set_booth_live, except: [:index, :now, :create]
  before_action :authorize_owner!, only: [:update, :destroy, :start, :finish, :share]

  def index
    lives = BoothLive.includes(:account).listing
    reminded = BoothLiveReminder.where(account: current_account, booth_live_id: lives.map(&:id)).pluck(:booth_live_id).to_set
    render json: lives, each_serializer: REST::BoothLiveSerializer, reminded_ids: reminded
  end

  # What's live right now, for the home feed's banner. Nothing for someone
  # tuned out of the Booth.
  def now
    return render json: [] if KornerTuneOut.exists?(account_id: current_account.id, korner_slug: 'booth')

    render json: BoothLive.includes(:account).live.order(started_at: :desc).limit(5), each_serializer: REST::BoothLiveSerializer
  end

  def show
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  def create
    @booth_live = BoothLive.create!(booth_live_params.merge(account: current_account, starts_at: starts_at_param || Time.current))
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  def update
    raise Mastodon::NotPermittedError if @booth_live.ended?

    attributes = booth_live_params
    attributes[:starts_at] = starts_at_param if params.key?(:starts_at) && @booth_live.state == 'scheduled'
    @booth_live.update!(attributes.compact)
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  def destroy
    raise Mastodon::NotPermittedError if @booth_live.live?

    @booth_live.destroy!
    render_empty
  end

  def start
    raise Mastodon::NotPermittedError if @booth_live.ended?

    @booth_live.start!
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  # "Remind me": a Nudge when the host goes live. Only for a set that
  # hasn't started, and not for your own.
  def remind
    raise Mastodon::NotPermittedError unless @booth_live.state == 'scheduled' && @booth_live.account_id != current_account.id

    BoothLiveReminder.find_or_create_by!(account: current_account, booth_live: @booth_live)
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  def unremind
    BoothLiveReminder.where(account: current_account, booth_live: @booth_live).delete_all
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  def finish
    @booth_live.finish!
    render json: @booth_live, serializer: REST::BoothLiveSerializer
  end

  # Tell your feed: "live now" once it has started, "playing live on …"
  # before. A plain post linking to the room, at the reach the host picks.
  def share
    raise Mastodon::NotPermittedError if @booth_live.ended?

    status = PostStatusService.new.call(
      current_account,
      text: share_text,
      visibility: REACH.include?(params[:visibility].to_s) ? params[:visibility] : 'public',
      application: doorkeeper_token.application
    )
    @booth_live.update!(status_id: status.id)
    render json: status, serializer: REST::StatusSerializer
  end

  private

  def set_booth_live
    @booth_live = BoothLive.find(params[:id])
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless current_account.id == @booth_live.account_id || current_user.role&.can?(:manage_reports)
  end

  def booth_live_params
    params.permit(:title, :description, genres: [])
  end

  def starts_at_param
    Time.zone.parse(params[:starts_at].to_s) if params[:starts_at].present?
  rescue ArgumentError
    nil
  end

  def share_text
    url = "#{root_url.chomp('/')}/hub/booth/live/#{@booth_live.id}"
    # The room page shows the start time in each reader's own time zone, so
    # the post links there rather than printing a server-side time.
    lead = @booth_live.live? ? "Live now in the Booth: #{@booth_live.title}" : "Playing live in the Booth soon: #{@booth_live.title}"
    comment = params[:comment].to_s.strip
    [comment.presence, "#{lead}\n\n#{url}"].compact.join("\n\n")
  end
end
