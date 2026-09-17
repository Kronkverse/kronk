# frozen_string_literal: true

# One signed-in device on the Account & Security surface. Display-only fields
# plus a `current` flag for the session backing this very request. Browser /
# platform strings are humanised server-side (reusing the `sessions.browsers.*`
# / `sessions.platforms.*` i18n the mailers already use) so the client shows
# them without a second lookup table. IP is the user's own — this serializer
# only ever runs over `current_user.session_activations`.
class REST::SessionActivationSerializer < ActiveModel::Serializer
  attributes :id, :current, :browser, :platform, :device, :ip, :last_active_at

  def id
    object.id.to_s
  end

  # The session whose access token this request arrived on — i.e. the device
  # the user is looking at right now. Display-only: the UI shows no revoke
  # button for it, and the controller refuses to revoke it.
  def current
    current_token_id.present? && object.access_token_id == current_token_id
  end

  def browser
    I18n.t("sessions.browsers.#{object.browser}", default: object.browser.to_s.humanize)
  end

  def platform
    I18n.t("sessions.platforms.#{object.platform}", default: object.platform.to_s.humanize)
  end

  def device
    detection = object.detection.device

    if detection.mobile?
      'mobile'
    elsif detection.tablet?
      'tablet'
    else
      'desktop'
    end
  end

  def ip
    object.ip.to_s.presence
  end

  def last_active_at
    object.updated_at
  end

  private

  def current_token_id
    instance_options[:current_token_id]
  end
end
