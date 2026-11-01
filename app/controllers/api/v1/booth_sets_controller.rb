# frozen_string_literal: true

class Api::V1::BoothSetsController < Api::BaseController
  PAGE_SIZE = 40
  # Musik's By artist and By kind rows are drawn from the newest sets in one
  # request (`limit`), so they may ask for more than a page.
  MAX_LIMIT = 200
  # First listens: recent sets that have barely been heard yet, so new
  # voices get a front-row spot instead of a chart.
  FIRST_LISTENS_WINDOW = 30.days
  FIRST_LISTENS_MAX_PLAYS = 10
  REACH = %w(public orbit mates self_only).freeze
  # The order a listener picks in Musik. Never ranked for them, and no
  # popularity order: Fewest listens lets them dig for new voices.
  SORTS = {
    'newest' => { id: :desc },
    'fewest' => { play_count: :asc, id: :desc },
    'longest' => Arel.sql('booth_sets.duration_seconds DESC NULLS LAST, booth_sets.id DESC'),
  }.freeze

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :play, :share, :confirm_credit, :remove_credit, :save, :unsave]
  before_action :require_user!, except: [:index, :show]
  before_action :set_booth_set, except: [:index, :create]

  def index
    # No `:event` here — `belongs_to :event` was retired from BoothSet on
    # 2026-08-15 with the `booth_sets.event_id` FK drop (Phase 5b); the
    # Kalendar link lives on `korner_attachments` now. The preload was
    # left behind, so every request to this endpoint raised
    # `ActiveRecord::AssociationNotFoundError` and 500'd — which showed
    # up as an empty Booth for everyone, since the grid is this one call.
    @booth_sets = listing_scope
                  .includes(:account, :audio_attachment, :cover_attachment, credits: :account, tracks: :audio_attachment)
                  .order(SORTS.fetch(sort_param))
                  .limit(page_size)
    @booth_sets = @booth_sets.where.not(account_id: Block.where(target_account_id: current_account.id).select(:account_id)) if current_account
    @booth_sets = page(@booth_sets)
    @booth_sets = @booth_sets.where('? = ANY (booth_sets.genres)', params[:genre].to_s) if params[:genre].present?
    @booth_sets = @booth_sets.where(kind: params[:kind].to_s) if params[:kind].present?
    @booth_sets = first_listens(@booth_sets) if truthy?(params[:first_listens])
    @booth_sets = search(@booth_sets, params[:q]) if params[:q].present?
    render json: @booth_sets, each_serializer: REST::BoothSetSerializer, saved_ids: saved_ids(@booth_sets)
  end

  def show
    raise ActiveRecord::RecordNotFound unless @booth_set.published? || owner?
    # Someone the artist blocked gets nothing, as everywhere else.
    raise ActiveRecord::RecordNotFound if current_account && !owner? && @booth_set.account.blocking?(current_account)

    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def create
    @booth_set = current_account.booth_sets.new(booth_set_params)
    # The artist is the uploader. `artist_name` is the credit line built from
    # them and whoever they credit, not something typed.
    @booth_set.artist_name = @booth_set.credit_line
    set_audio! if params[:audio_id].present?
    set_cover! if params[:cover_id].present?
    assign_tracks!
    tagged = BoothSet.transaction do
      @booth_set.save!
      replace_credits!
    end
    announce_tags(tagged)
    render json: @booth_set.reload, serializer: REST::BoothSetSerializer
  end

  def update
    authorize_owner!
    set_audio! if params[:audio_id].present?
    if params[:remove_cover] == 'true'
      @booth_set.cover_attachment = nil
    elsif params[:cover_id].present?
      set_cover!
    end
    @booth_set.assign_attributes(booth_set_params)
    assign_tracks!
    tagged = BoothSet.transaction do
      @booth_set.save!
      replace_credits!
    end
    announce_tags(tagged)
    render json: @booth_set.reload, serializer: REST::BoothSetSerializer
  end

  # The person tagged on a set saying "yes, that's me".
  def confirm_credit
    own_credit.update!(verified: true)
    render json: @booth_set.reload, serializer: REST::BoothSetSerializer
  end

  # The person tagged on a set taking themselves off it.
  def remove_credit
    own_credit.destroy!
    @booth_set.update!(artist_name: @booth_set.reload.credit_line)
    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def destroy
    authorize_owner!
    @booth_set.destroy!
    render_empty
  end

  # Keep a set to come back to (My sets → Saved). Private to the member.
  def save
    raise ActiveRecord::RecordNotFound unless @booth_set.published? || owner?

    BoothSetSave.find_or_create_by!(account: current_account, booth_set: @booth_set)
    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def unsave
    BoothSetSave.where(account: current_account, booth_set: @booth_set).delete_all
    render json: @booth_set, serializer: REST::BoothSetSerializer
  end

  def play
    @booth_set.increment_play_count! if @booth_set.published?
    render_empty
  end

  def share
    raise Mastodon::NotPermittedError unless @booth_set.published?

    status = PostStatusService.new.call(
      current_account,
      text: share_text,
      visibility: share_reach,
      application: doorkeeper_token.application
    )

    # Link status back so timeline renders the shared status as a Booth card
    # (Status has_one :booth_set via booth_sets.status_id per §5.5). Re-sharing
    # points the association at the newest status; older shares stay in the
    # timeline as plain text.
    @booth_set.update!(status_id: status.id)
    status.update_column(:source_korner, 'booth') # feed projection discriminator (§3.2)

    render json: status, serializer: REST::StatusSerializer
  end

  private

  # Everyone's published sets; `mine` is your own, drafts included;
  # `saved` is what you kept.
  def listing_scope
    if truthy?(params[:mine]) && current_account
      BoothSet.where(account: current_account)
    elsif truthy?(params[:saved]) && current_account
      BoothSet.published.where(id: BoothSetSave.where(account: current_account).select(:booth_set_id))
    else
      BoothSet.published
    end
  end

  # Published in the last month, under ten listens, and not your own (you
  # can't give yourself a first listen).
  def first_listens(scope)
    scope = scope.where(created_at: FIRST_LISTENS_WINDOW.ago..).where(play_count: ...FIRST_LISTENS_MAX_PLAYS)
    current_account ? scope.where.not(account_id: current_account.id) : scope
  end

  def page_size
    params[:limit].present? ? params[:limit].to_i.clamp(1, MAX_LIMIT) : PAGE_SIZE
  end

  def sort_param
    SORTS.key?(params[:sort]) ? params[:sort] : 'newest'
  end

  # Newest pages back from `max_id`; the other orders page by `offset`.
  def page(scope)
    if sort_param == 'newest'
      params[:max_id].present? ? scope.where(id: ...params[:max_id].to_i) : scope
    else
      scope.offset(params[:offset].to_i.clamp(0, 10_000))
    end
  end

  def saved_ids(sets)
    return Set.new unless current_account

    BoothSetSave.where(account: current_account, booth_set_id: sets.map(&:id)).pluck(:booth_set_id).to_set
  end

  def truthy?(value)
    ActiveModel::Type::Boolean.new.cast(value) == true
  end

  # Title, credit line or a genre tag, case-insensitively.
  def search(scope, query)
    pattern = "%#{BoothSet.sanitize_sql_like(query.to_s.squish.first(100))}%"
    scope.where("booth_sets.title ILIKE :q OR booth_sets.artist_name ILIKE :q OR array_to_string(booth_sets.genres, ' ') ILIKE :q", q: pattern)
  end

  # The reach the member picked on the share form. Anything else (no
  # choice, or a pre-2.0 default like `unlisted` still sitting in
  # `default_privacy`) falls back to the user's default when that is a
  # reach tier, and to Kronkverse otherwise.
  def share_reach
    [params[:visibility], current_account.user&.setting_default_privacy].find { |value| REACH.include?(value.to_s) } || 'public'
  end

  def own_credit
    @booth_set.credits.find_by!(account_id: current_account.id)
  end

  # `collaborators` replaces who is credited besides the uploader: an array of
  # `{ account_id }` (a Kronk account, tagged) or `{ name }` (someone who is
  # not on Kronk). Absent means "leave the credits alone", which is also what
  # keeps a typed `artist_name` on a set from before credits existed. Returns
  # the accounts newly tagged.
  def replace_credits!
    return [] unless params.key?(:collaborators)

    existing = @booth_set.credits.index_by { |credit| credit.account_id || credit.name }
    kept = []
    tagged = []

    wanted_credits.each_with_index do |entry, position|
      credit = existing[entry[:account]&.id || entry[:name]]
      unless credit
        credit = @booth_set.credits.build(account: entry[:account], name: entry[:account] ? nil : entry[:name])
        tagged << entry[:account] if entry[:account]
      end
      credit.update!(position: position)
      kept << credit.id
    end

    @booth_set.credits.where.not(id: kept).destroy_all
    @booth_set.update!(artist_name: @booth_set.reload.credit_line)
    tagged
  end

  def wanted_credits
    raw = params[:collaborators]
    raw = raw.values if raw.respond_to?(:values) && !raw.is_a?(Array)

    Array(raw).filter_map { |entry| wanted_credit(entry) }.uniq { |e| e[:account]&.id || e[:name] }.first(BoothSet::MAX_CREDITS)
  end

  def wanted_credit(entry)
    return unless entry.respond_to?(:[])

    if entry[:account_id].present?
      account = Account.local.without_suspended.find_by(id: entry[:account_id])
      account && account.id != @booth_set.account_id ? { account: account } : nil
    else
      name = entry[:name].to_s.squish.first(BoothSetArtist::NAME_MAX)
      name.present? ? { name: name } : nil
    end
  end

  def announce_tags(accounts)
    accounts.each do |account|
      Kronk::KornerEvents.publish(
        'booth.set.tagged',
        actor_account_id: @booth_set.account_id,
        recipient_account_id: account.id,
        booth_set_id: @booth_set.id
      )
    end
  end

  # What the musician wrote, or the set's title, as any korner's post: the
  # set's card carries the artist and opens it.
  def share_text
    params[:comment].to_s.strip.presence || @booth_set.title
  end

  def set_booth_set
    @booth_set = BoothSet.find(params[:id])
  end

  def owner?
    current_account&.id == @booth_set.account_id
  end

  def staff?
    current_user&.role&.can?(:manage_reports)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless owner? || staff?
  end

  def set_audio!
    @booth_set.audio_attachment = current_account.media_attachments.find(params[:audio_id])
  end

  def set_cover!
    @booth_set.cover_attachment = current_account.media_attachments.find(params[:cover_id])
  end

  # `tracks` is an album's or EP's running order (docs/spaces/booth.md,
  # Albums): an array of `{ id }` for a track it already has, or
  # `{ audio_id }` for a newly uploaded file, each with a `title` and
  # optionally `duration_seconds`. It replaces the tracks; one left out is
  # removed. Absent means "leave the tracks alone". The model checks there
  # are enough, and that only albums and EPs have any.
  def assign_tracks!
    return unless params.key?(:tracks)

    existing = @booth_set.tracks.index_by(&:id)
    kept = wanted_tracks.first(BoothSet::ALBUM_TRACKS_MAX + 1).each_with_index.map do |entry, position|
      track = entry[:id].present? ? existing.fetch(entry[:id].to_i) { raise ActiveRecord::RecordNotFound } : new_track(entry)
      track.assign_attributes(position: position, title: entry[:title].to_s.squish.presence || track.title)
      track.duration_seconds = entry[:duration_seconds].to_i if entry[:duration_seconds].to_i.positive?
      track
    end

    (existing.values - kept).each(&:mark_for_destruction)
  end

  def new_track(entry)
    media = current_account.media_attachments.find(entry[:audio_id])
    @booth_set.tracks.build(audio_attachment: media, duration_seconds: BoothSetTrack.media_duration(media))
  end

  def wanted_tracks
    raw = params[:tracks]
    raw = raw.values if raw.respond_to?(:values) && !raw.is_a?(Array)

    Array(raw).select { |entry| entry.respond_to?(:[]) && (entry[:id].present? || entry[:audio_id].present?) }
  end

  def booth_set_params
    # `event_id` retired 2026-08-15 alongside the FK drop (Phase 5b).
    # The Kalendar → Booth link now lives in `korner_attachments` — an
    # event owner attaches a booth set via `<AttachmentPicker>` from
    # the event side. `event_name` + `event_date` remain as free-text
    # context on the set itself. `artist_name` is not accepted: it is the
    # credit line, built from the uploader and `collaborators`.
    params.permit(:title, :description, :event_name, :event_date, :kind,
                  :duration_seconds, :published, :cover_offset_y, :tracklist_text, genres: [])
  end
end
