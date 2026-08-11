# frozen_string_literal: true

# Albutts — shared-album korner REST. This slice covers CRUD on the
# album itself; contributions live in the nested PhotosController.
#
# Visibility gating happens at query time via `Album.visible_to(viewer)`;
# per-action authorisation (`update` / `destroy`) requires the caller be
# the owner.
class Api::V1::Albutts::AlbumsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!, except: [:index, :show]
  before_action :set_album,     only: [:show, :update, :destroy]

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
    render json: scope.limit(clamp_limit), each_serializer: REST::AlbumSerializer
  end

  def show
    raise Mastodon::NotPermittedError unless @album.visible_to?(current_account)

    render json: @album, serializer: REST::AlbumSerializer
  end

  def create
    @album = current_account.owned_albums.new(album_params_for_create)

    if @album.save
      sync_krews!
      sync_contributors!
      Albutts::PublishAlbum.new(@album).call
      render json: @album.reload, serializer: REST::AlbumSerializer, status: 201
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    authorize_owner!

    if @album.update(album_params_for_update)
      sync_krews! if krew_params_present?
      sync_contributors! if params.key?(:contributor_account_ids)
      render json: @album.reload, serializer: REST::AlbumSerializer
    else
      render json: { error: @album.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    authorize_owner!
    @album.destroy!
    render_empty
  end

  private

  def set_album
    @album = Album.find(params[:id])
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

  def album_params_for_create
    normalize_visibility(params.expect(album: [:title, :description, :visibility, :contribution, :cover_media_attachment_id]))
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

  def krew_ids_param
    Array(params[:krew_ids]).map(&:to_i).reject(&:zero?).uniq
  end

  # Krews that also grant contribution. Explicit param wins; otherwise a legacy
  # `contribution=krew` client (no contributor list) means the audience krews
  # double as contributors — the pre-2026-08-11 auto-mirror behaviour.
  def contributor_krew_ids_param
    if params.key?(:contributor_krew_ids)
      Array(params[:contributor_krew_ids]).map(&:to_i).reject(&:zero?).uniq
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
  # update this replaces the set wholesale (an empty list removes every krew).
  def sync_krews!
    contributor_ids = contributor_krew_ids_param
    audience_ids = (krew_ids_param + contributor_ids).uniq

    @album.album_krews.where.not(krew_id: audience_ids).destroy_all
    existing = @album.album_krews.pluck(:krew_id)
    (audience_ids - existing).each { |kid| @album.album_krews.create!(krew_id: kid) }

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

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @album.owner_id == current_account.id
  end
end
