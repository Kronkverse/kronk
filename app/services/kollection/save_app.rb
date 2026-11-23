# frozen_string_literal: true

# Adds an app to Kollection, or changes one (docs/spaces/kollection.md).
#
# Params (each optional on an update):
#
#   name, description, website
#   sign_in        true: it signs people in with Kronk, so it gets (or
#                  keeps) a Doorkeeper application with no owner. An app
#                  that signs in stays one; turning it into a link would
#                  strand everyone connected to it, so `false` is ignored
#                  once it does.
#   redirect_uris  where Kronk sends people back after sign-in, one per
#                  line (or an array)
#   scopes         what it may ask to see, from KollectionApp::SCOPES
#   icon_id        one of `actor`'s own unattached uploads; blank removes it
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
    @app.assign_attributes(@params.slice(:name, :description, :website).to_h)
    @app.icon_media_attachment = icon if @params.key?(:icon_id)

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

  def icon
    id = Integer(@params[:icon_id].to_s, exception: false)
    return if id.nil?
    return @app.icon_media_attachment if id == @app.icon_media_attachment_id

    MediaAttachment.find_by(id: id, account: @actor, status_id: nil)
  end
end
