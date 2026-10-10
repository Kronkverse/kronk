# frozen_string_literal: true

# FreeTheDream's shared map: the JSON endpoints the page calls when it runs
# with `FTD_CONFIG.backend = 'kronk'` (docs/spaces/freethedream.md).
#
# The map is open: anyone adds a project and it's on the map straight away,
# run by whoever added it, who chooses whether anyone can join in or they
# accept helpers. There are no admins and no map-wide documents — everything
# lives in each member's own document (FreethedreamDocument).
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

  rescue_from FreethedreamDocument::Invalid do |e|
    render json: { error: e.message }, status: 422
  end

  # Who you are on the map. `admin` stays in the shape the page reads; the
  # open map has no admins.
  def me
    render json: { id: current_account.id.to_s, admin: false }
  end

  # The map as you're allowed to see it (FreethedreamDocument.view_for).
  # Polled every 15s by each open page, so it answers 304 when nothing has
  # changed: the ETag comes from ids, timestamps and the viewer, so an
  # unchanged map (the common case, with logos making it large) never loads
  # the documents.
  def state
    version = FreethedreamDocument.members.order(:id).pluck(:id, :updated_at).map { |id, at| [id, at.to_f] }
    return unless stale?(etag: [current_account.id, version], public: false)

    docs = FreethedreamDocument.members.to_a.to_h { |d| [d.key, d.data] }
    members = FreethedreamDocument.view_for(docs, current_account.id.to_s)
    render json: { members: members, map: {}, names: names_for(members.keys) }
  end

  # The viewer's own document, replaced whole. Only the fields the page
  # writes are kept, cleaned (FreethedreamDocument.clean_member).
  def update_member
    body = parsed_body(FreethedreamDocument::MAX_MEMBER_BYTES) or return

    doc = FreethedreamDocument.find_or_initialize_by(kind: 'member', key: current_account.id.to_s)
    doc.update!(data: FreethedreamDocument.clean_member(body.slice(*MEMBER_FIELDS)), updated_by_account_id: current_account.id)
    head 204
  end

  private

  def require_signed_in!
    render json: { error: 'Sign in to use the map' }, status: 401 unless current_user&.functional?
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

  # Display names for everyone with a document: creators, helpers and
  # anyone asking to help all write their own.
  def names_for(ids)
    ids = ids.grep(/\A\d+\z/).first(1000)
    Account.where(id: ids).pluck(:id, :display_name, :username)
           .to_h { |id, display, username| [id.to_s, display.presence || username] }
  end
end
