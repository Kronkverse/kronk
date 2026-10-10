# frozen_string_literal: true

# FreeTheDream's shared map: the four JSON endpoints the page calls when it
# runs with `FTD_CONFIG.backend = 'kronk'` (docs/spaces/freethedream.md).
#
# The page runs in an iframe on the same origin, so it authenticates with the
# Kronk session cookie, not an OAuth token. Reads are plain GETs; writes carry
# the page's `X-CSRF-Token`, and without a valid one `null_session` drops the
# session, so a forged write arrives signed out and is refused.
#
# The page treats 401/403 as "read-only" and 413 as "storage full", so those
# are the codes used here.
class Api::V1::FreethedreamController < Api::BaseController
  MEMBER_FIELDS = %w(drops claims edits logos follows).freeze

  before_action :require_signed_in!
  before_action :require_admin!, only: :update_map

  # Who you are on the map. Admins approve suggestions and write map/*.
  def me
    render json: { id: current_account.id.to_s, admin: admin? }
  end

  # Everything the map shows. Polled every 15s by each open page, so it
  # answers 304 when nothing has changed since the last poll.
  # The ETag comes from ids and timestamps alone, so an unchanged map (the
  # common case, with logos making it large) never loads the documents.
  def state
    version = FreethedreamDocument.order(:id).pluck(:id, :updated_at).map { |id, at| [id, at.to_f] }
    return unless stale?(etag: version, public: false)

    docs = FreethedreamDocument.all.to_a
    members = docs.select { |d| d.kind == 'member' }.to_h { |d| [d.key, d.data] }
    map = docs.select { |d| d.kind == 'map' }.to_h { |d| [d.key, d.data] }
    render json: { members: members, map: map, names: names_for(members, map) }
  end

  # The viewer's own document, replaced whole. Only the fields the page
  # writes are kept.
  def update_member
    body = parsed_body(FreethedreamDocument::MAX_MEMBER_BYTES) or return
    save!('member', current_account.id.to_s, FreethedreamDocument.clean_member(body.slice(*MEMBER_FIELDS)))
  end

  # One admin-only map document, replaced whole. Only the ids the page uses.
  def update_map
    key = params[:doc_id].to_s
    return render json: { error: 'Unknown map document' }, status: 404 unless FreethedreamDocument.map_key?(key)

    body = parsed_body(FreethedreamDocument::MAX_MAP_BYTES) or return
    save!('map', key, FreethedreamDocument.clean_map(body))
  end

  rescue_from FreethedreamDocument::Invalid do |e|
    render json: { error: e.message }, status: 422
  end

  private

  def require_signed_in!
    render json: { error: 'Sign in to use the map' }, status: 401 unless current_user&.functional?
  end

  def require_admin!
    render json: { error: 'Only the map’s admins can do this' }, status: 403 unless admin?
  end

  # The map's admins are Kronk's stewards. One place to change if a
  # FreeTheDream Krew takes it over (docs/spaces/freethedream.md).
  def admin?
    role = current_user.role
    role.present? && (role.can?(:administrator) || role.can?(:manage_reports))
  end

  def parsed_body(max_bytes)
    raw = request.raw_post.to_s
    if raw.bytesize > max_bytes
      render json: { error: 'Too large' }, status: 413
      return
    end

    body = JSON.parse(raw)
    return body if body.is_a?(Hash)

    render json: { error: 'Expected a JSON object' }, status: 422
    nil
  rescue JSON::ParserError
    render json: { error: 'Invalid JSON' }, status: 422
    nil
  end

  def save!(kind, key, data)
    doc = FreethedreamDocument.find_or_initialize_by(kind: kind, key: key)
    doc.update!(data: data, updated_by_account_id: current_account.id)
    head 204
  end

  # Display names for everyone the page will name: members, and the account
  # ids listed as running a project in map/stewards.
  def names_for(members, map)
    ids = members.keys
    stewards = map.dig('stewards', 'map')
    ids += stewards.values.flatten if stewards.is_a?(Hash)
    ids = ids.map(&:to_s).grep(/\A\d+\z/).uniq.first(500)
    Account.where(id: ids).pluck(:id, :display_name, :username)
           .to_h { |id, display, username| [id.to_s, display.presence || username] }
  end
end
