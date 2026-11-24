# frozen_string_literal: true

# Adds an app to Kollection, or changes one (docs/spaces/kollection.md).
#
# Params (each optional on an update):
#
#   name, tagline, description, website, download_url, made_by
#   category       one of KollectionApp::CATEGORIES, or blank
#   platforms      any of KollectionApp::PLATFORMS
#   sign_in        true: it signs people in with Kronk, so it gets (or
#                  keeps) a Doorkeeper application with no owner. An app
#                  that signs in stays one; turning it into a link would
#                  strand everyone connected to it, so `false` is ignored
#                  once it does.
#   redirect_uris  where Kronk sends people back after sign-in, one per
#                  line (or an array)
#   scopes         what it may ask to see, from KollectionApp::SCOPES
#   icon_id        one of `actor`'s own unattached uploads; blank removes it
#   cover_id       the same, for the cover picture
#   screenshot_ids the screenshots, in order: each one of `actor`'s own
#                  unattached uploads or already one of this app's; at most
#                  KollectionApp::SCREENSHOTS_LIMIT (more is refused)
#
# The listing and its Doorkeeper application are saved together, so a bad
# redirect URI leaves nothing behind. The Doorkeeper application is
# confidential (it gets a secret) and is otherwise exactly what
# /settings/applications makes, so Kronk's OAuth and OIDC sign-in treat it
# the same.
class Kollection::SaveApp
  def initialize(app, actor:, params:)
    @app = app
    @actor = actor
    @params = params
  end

  def call
    @app.assign_attributes(@params.slice(:name, :tagline, :description, :website, :download_url, :made_by, :category).to_h)
    @app.platforms = Array(@params[:platforms]) if @params.key?(:platforms)
    @app.icon_media_attachment = upload(:icon_id, @app.icon_media_attachment) if @params.key?(:icon_id)
    @app.cover_media_attachment = upload(:cover_id, @app.cover_media_attachment) if @params.key?(:cover_id)
    arrange_screenshots if @params.key?(:screenshot_ids)

    build_sign_in if sign_in?
    sync_sign_in if @app.signs_in?

    @app.save!
    @app
  end

  private

  def sign_in?
    ActiveModel::Type::Boolean.new.cast(@params[:sign_in]) || false
  end

  def build_sign_in
    return if @app.signs_in?

    @app.oauth_application = Doorkeeper::Application.new(owner: nil, confidential: true)
    @app.oauth_application.scopes = KollectionApp::DEFAULT_SCOPES.join(' ')
  end

  def sync_sign_in
    application = @app.oauth_application
    application.name = @app.name
    application.website = @app.website
    application.redirect_uri = redirect_uris.join("\n") if @params.key?(:redirect_uris) || application.new_record?
    application.scopes = scopes.join(' ') if @params.key?(:scopes)
  end

  def redirect_uris
    value = @params[:redirect_uris]
    lines = value.is_a?(Array) ? value : value.to_s.split(/\s+/)
    lines.map(&:strip).compact_blank.uniq
  end

  # Only the offered scopes, in their order; asking for none means the
  # defaults.
  def scopes
    asked = Array(@params[:scopes]).flat_map { |scope| scope.to_s.split }
    chosen = KollectionApp::SCOPES & asked
    chosen.presence || KollectionApp::DEFAULT_SCOPES
  end

  # The upload `key` names: the one already there, or one of the actor's
  # own unattached uploads. Blank or anything else is none.
  def upload(key, current)
    id = Integer(@params[key].to_s, exception: false)
    return if id.nil?
    return current if current&.id == id

    MediaAttachment.find_by(id: id, account: @actor, status_id: nil)
  end

  # Replaces the screenshots with the ids given, in that order. Ids that are
  # neither already the app's nor the actor's own uploads are dropped.
  def arrange_screenshots
    ids = Array(@params[:screenshot_ids]).filter_map { |id| Integer(id.to_s, exception: false) }.uniq
    raise Mastodon::ValidationError, "An app can have at most #{KollectionApp::SCREENSHOTS_LIMIT} screenshots" if ids.size > KollectionApp::SCREENSHOTS_LIMIT

    current = @app.screenshots.index_by(&:media_attachment_id)
    own = MediaAttachment.where(id: ids - current.keys, account: @actor, status_id: nil).index_by(&:id)

    kept = ids.filter_map.with_index do |id, position|
      shot = current[id] || (own[id] && @app.screenshots.build(media_attachment: own[id]))
      shot&.tap { |s| s.position = position }
    end
    (current.values - kept).each(&:mark_for_destruction)
  end
end
