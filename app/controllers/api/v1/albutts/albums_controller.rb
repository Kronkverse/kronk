# frozen_string_literal: true

# Albutts — shared-album korner REST. This slice covers CRUD on the
# album itself; contributions live in the nested PhotosController.
#
# Visibility gating happens at query time via `Album.visible_to(viewer)`.
# `update` needs the owner, or any member for a Krew album; `destroy` the
# owner, or a Krew's sole member (Album#managed_by?, #deletable_by?).
class Api::V1::Albutts::AlbumsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :give]
  before_action :require_user!, except: [:index, :show]
  before_action :set_album,     only: [:show, :update, :destroy, :download, :give]

  DEFAULT_LIMIT = 24
  MAX_LIMIT     = 60

  # Faces of the `<ScopeTitle>` rotator on /hub/albutts. `all` is the
  # legacy behaviour (every album the viewer can see); the others
  # narrow that set. Unknown values fall back to `all` so a stale URL
  # segment can't 404.
  SCOPES = %w(all mine contributed mates).freeze

  def index
    scope = Album.visible_to(current_account).recent
    scope = narrow_by_scope(scope)
    # A Krew's albums, for its page (docs/spaces/krew.md, Linking).
    scope = scope.where(id: AlbumKrew.where(krew_id: params[:krew_id]).select(:album_id)) if params[:krew_id].present?
    render json: scope.preload(:cover_media_attachment, :krew, owner: [:account_stat, :user]).limit(clamp_limit), each_serializer: REST::AlbumSerializer, list: true
  end

  def show
    # Not found, not forbidden: a guessed name must not reveal a hidden album.
    raise ActiveRecord::RecordNotFound unless @album.visible_to?(current_account)

    photos = AlbumPhoto.newest_bursts_first(@album.photos.for_display.to_a)
    render json: @album, serializer: REST::AlbumSerializer, photos: photos,
           relationships: StatusRelationshipsPresenter.new(photos.map(&:status), current_user&.account_id)
  end

  def create
    return create_krew_album if params[:krew_id].present?

    @album = current_account.owned_albums.new(album_params_for_create)

    if @album.save
      sync_krews!
      sync_contributors!
      Albutts::PublishAlbum.new(@album).call
      notify_tagged!(before: '')
      render json: @album.reload, serializer: REST::AlbumSerializer, status: 201
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    raise Mastodon::NotPermittedError unless @album.managed_by?(current_account)
    return update_krew_album if @album.krew_album?

    described = @album.description.to_s

    if @album.update(album_params_for_update)
      sync_krews! if krew_params_present?
      sync_contributors! if params.key?(:contributor_account_ids)
      notify_tagged!(before: described)
      render json: @album.reload, serializer: REST::AlbumSerializer
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    raise Mastodon::NotPermittedError unless @album.deletable_by?(current_account)

    @album.destroy!
    render_empty
  end

  # POST /api/v1/albutts/albums/:id/give (krew_id) — the owner gives a
  # personal album to a Krew they're in. One way: it is then the Krew's.
  # A Krew album is seen by the Krew or everyone, so a public album stays
  # public only if the Krew is listed; anything else becomes the Krew's alone.
  def give
    raise Mastodon::NotPermittedError if @album.krew_album? || @album.owner_id != current_account.id

    krew = current_account.krews.find(params[:krew_id])
    return render json: { error: 'krew is archived' }, status: 422 if krew.archived?

    before = @album.visibility
    Album.transaction do
      @album.update!(krew: krew, visibility: @album.public_scope? && krew.listed? ? 'public' : 'self_only', contribution: :invited)
      @album.contribution_requests.delete_all
      @album.album_krews.where.not(krew_id: krew.id).update_all(for_contribution: false)
      @album.album_krews.find_or_create_by!(krew: krew).update!(for_contribution: true)
      Kronk::StatusKrews.add(@album.post_status_ids, krew.id)
    end
    Albutts::RescopeAlbum.new(@album, before: before).call

    render json: @album.reload, serializer: REST::AlbumSerializer
  end

  # A zip of the album, or of `photo_ids` from it, for anyone who can see
  # it. Opened as a link by the browser, so it is the one action here that
  # is reached with the web session and no access token.
  def download
    raise ActiveRecord::RecordNotFound unless @album.visible_to?(current_account)

    archive = Albutts::AlbumArchive.new(@album, photo_ids: download_photo_ids)
    return render json: { error: 'There are no photos to download.' }, status: 404 if archive.empty? # rubocop:disable I18n/RailsI18n/DecorateString
    return render json: { error: 'That is too much for one download. Choose fewer photos.' }, status: 422 if archive.too_large? # rubocop:disable I18n/RailsI18n/DecorateString

    send_archive(archive)
  end

  private

  # A Krew album (docs/spaces/albutts.md, Krew albums): made by a member,
  # seen by the Krew or everyone (`audience`), added to by its members.
  def create_krew_album
    krew = current_account.krews.find(params[:krew_id])
    return render json: { error: 'krew is archived' }, status: 422 if krew.archived?

    attrs = album_params_for_create.except(:visibility, :contribution)
    @album = current_account.owned_albums.new(attrs.merge(krew: krew, visibility: krew_audience_visibility, contribution: :invited))

    if @album.save
      @album.album_krews.create!(krew: krew, for_contribution: true)
      Albutts::PublishAlbum.new(@album).call
      notify_tagged!(before: '')
      render json: @album.reload, serializer: REST::AlbumSerializer, status: 201
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  # Any member edits the title, description, cover and audience. Its Krews
  # and who adds are fixed by being the Krew's, so those params are ignored.
  def update_krew_album
    described = @album.description.to_s
    before = @album.visibility
    attrs = params.fetch(:album, {}).permit(:title, :description, :cover_media_attachment_id).to_h
    attrs[:visibility] = krew_audience_visibility if params.key?(:audience)

    if @album.update(attrs)
      Albutts::RescopeAlbum.new(@album, before: before).call
      notify_tagged!(before: described)
      render json: @album.reload, serializer: REST::AlbumSerializer
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def krew_audience_visibility
    Album::KREW_AUDIENCES.fetch(params[:audience].to_s, 'self_only')
  end

  # Tagging people in an album (Kommons #117430484820960056): an @name in
  # the description tells that person, once, when the name first appears.
  # Only someone who can open the album is told; a name that matches nobody
  # here is just text. A photo's caption needs none of this: the photo is a
  # post, and a post's mentions already notify.
  def notify_tagged!(before:)
    already = tagged_accounts(before).map(&:id)

    tagged_accounts(@album.description).each do |account|
      next if account.id == current_account.id || already.include?(account.id)
      next unless @album.reload.visible_to?(account)

      # Straight to the router, as a tag in a photo's caption is
      # (`Albutts::PublishPhoto#notify_tagged!`): one notice, one person.
      Nudges::EventRouter.deliver(
        actor: current_account,
        recipient: account,
        source_korner_slug: 'albutts',
        verb: 'tagged',
        source_type: 'Album',
        source_id: @album.id,
        interaction: 'interactive',
        cta_label: 'View album',
        cta_route: "/hub/albutts/albums/#{@album.id}",
        directed: true
      )
    end
  end

  def tagged_accounts(text)
    names = text.to_s.scan(/(?<![\w@])@([a-z0-9_]+)/i).flatten.map(&:downcase).uniq.first(20)
    return [] if names.empty?

    Account.local.where('lower(username) IN (?)', names).to_a
  end

  def set_album
    @album = Album.by_link!(params[:id])
  end

  # nil for the whole album.
  def download_photo_ids
    return nil if params[:photo_ids].blank?

    params[:photo_ids].to_s.split(',').map(&:to_i).reject(&:zero?).uniq
  end

  def send_archive(archive)
    file = archive.build
    response.headers['Content-Type'] = 'application/zip'
    response.headers['Content-Disposition'] = ActionDispatch::Http::ContentDisposition.format(disposition: 'attachment', filename: archive.filename)
    response.headers['Content-Length'] = file.size.to_s
    response.headers['Cache-Control'] = 'private, no-store'
    # Stops Rack::ETag reading the whole body to fingerprint it.
    response.headers['Last-Modified'] = Time.now.httpdate
    self.response_body = Albutts::AlbumArchive::Body.new(file)
  end

  def clamp_limit
    [params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min.clamp(1, MAX_LIMIT)
  end

  # Filter the base `visible_to` relation to the requested scope.
  # `mine` / `contributed` / `mates` all require a signed-in caller —
  # for an unauthenticated request they degrade to `all` rather than
  # 401 so the front-end can share one code path across states.
  def narrow_by_scope(relation)
    requested = params[:scope].to_s.presence_in(SCOPES) || 'all'
    return relation if current_account.nil? || requested == 'all'

    case requested
    when 'mine'
      relation.where(owner_id: current_account.id)
    when 'contributed'
      relation.where(id: AlbumPhoto.where(contributor_id: current_account.id).select(:album_id).distinct)
    when 'mates'
      relation.where(owner_id: current_account.mates.select(:id))
    else
      relation
    end
  end

  # Nobody but the owner adds photos unless the album says otherwise (Tal,
  # 2026-10-19): an album made without a `contribution` is `closed`.
  def album_params_for_create
    permitted = normalize_visibility(params.expect(album: [:title, :description, :visibility, :contribution, :cover_media_attachment_id]))
    permitted[:contribution] = 'closed' if permitted[:contribution].blank?
    permitted
  end

  def album_params_for_update
    normalize_visibility(params.expect(album: [:title, :description, :visibility, :contribution, :cover_media_attachment_id]))
  end

  # Krew is orthogonal now — accept a legacy `visibility=krew` from an
  # un-migrated client, mapping it to self_only. The krew(s) still arrive via
  # the separate krew_ids param, so the audience (owner + krew) is unchanged.
  def normalize_visibility(permitted)
    permitted[:visibility] = 'self_only' if permitted[:visibility] == 'krew'
    permitted
  end

  # Only Krews the owner is in: an album can't be posted into someone else's
  # Krew (it would land in that Krew's feed and echo the Krew back).
  def krew_ids_param
    Array(params[:krew_ids]).map(&:to_i).reject(&:zero?).uniq & own_krew_ids
  end

  def own_krew_ids
    @own_krew_ids ||= KrewMembership.where(account_id: current_account.id).pluck(:krew_id)
  end

  # Krews that also grant contribution. Explicit param wins; otherwise a legacy
  # `contribution=krew` client (no contributor list) means the audience krews
  # double as contributors — the pre-2026-08-11 auto-mirror behaviour.
  def contributor_krew_ids_param
    if params.key?(:contributor_krew_ids)
      Array(params[:contributor_krew_ids]).map(&:to_i).reject(&:zero?).uniq & own_krew_ids
    elsif @album.contribution_krew?
      krew_ids_param
    else
      []
    end
  end

  def contributor_account_ids_param
    Array(params[:contributor_account_ids]).map(&:to_i).reject(&:zero?).uniq
  end

  def krew_params_present?
    params.key?(:krew_ids) || params.key?(:contributor_krew_ids)
  end

  # Sync the album's krew set. Audience krews (the additive-visibility axis) are
  # the union of `krew_ids` and any contributor krews — a contributor krew must
  # also see the album. `for_contribution` flags the contributor subset. On
  # update this replaces the set wholesale (an empty list removes every krew),
  # except for Krews the owner is no longer in: the form can't offer those, so
  # an edit leaves them as they were rather than unlinking them by omission.
  def sync_krews!
    before = @album.album_krews.pluck(:krew_id)
    kept = before - own_krew_ids
    contributor_ids = (contributor_krew_ids_param + @album.album_krews.where(krew_id: kept, for_contribution: true).pluck(:krew_id)).uniq
    audience_ids = (krew_ids_param + contributor_ids + kept).uniq

    @album.album_krews.where.not(krew_id: audience_ids).destroy_all
    existing = @album.album_krews.pluck(:krew_id)
    (audience_ids - existing).each { |kid| @album.album_krews.create!(krew_id: kid) }

    # Posts already in the album follow its Krews (Kronk::StatusKrews).
    Kronk::StatusKrews.add(@album.post_status_ids, audience_ids - before)
    Kronk::StatusKrews.remove(@album.post_status_ids, before - audience_ids)

    @album.album_krews.where(krew_id: contributor_ids).update_all(for_contribution: true) if contributor_ids.any?
    @album.album_krews.where.not(krew_id: contributor_ids).update_all(for_contribution: false)
  end

  # Sync the specific-people contribution roster (the "invited" list).
  def sync_contributors!
    account_ids = contributor_account_ids_param
    @album.album_contributors.where.not(account_id: account_ids).destroy_all
    existing = @album.album_contributors.pluck(:account_id)
    (account_ids - existing).each { |aid| @album.album_contributors.create!(account_id: aid) }
  end
end
