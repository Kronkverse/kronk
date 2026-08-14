# frozen_string_literal: true

# One recent sign-in (successful or failed) on the Account & Security surface.
# Read-only; runs only over `current_user.login_activities`, so the IP is the
# user's own. Browser / platform humanised the same way as
# REST::SessionActivationSerializer.
class REST::LoginActivitySerializer < ActiveModel::Serializer
  attributes :id, :authentication_method, :success, :ip, :browser, :platform, :created_at

  def id
    object.id.to_s
  end

  def browser
    I18n.t("sessions.browsers.#{object.browser}", default: object.browser.to_s.humanize)
  end

  def platform
    I18n.t("sessions.platforms.#{object.platform}", default: object.platform.to_s.humanize)
  end

  def ip
    object.ip.to_s.presence
  end
end
