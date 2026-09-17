# frozen_string_literal: true

class Api::V1::InvitesController < Api::BaseController
  include RegistrationHelper

  skip_before_action :require_authenticated_user!, only: [:show]
  skip_around_action :set_locale, only: [:show]

  before_action :set_invite, only: [:show]
  before_action :check_valid_usage!, only: [:show]
  before_action :check_enabled_registrations!, only: [:show]

  def show
    account = @invite.user.account
    render json: {
      invite_code: params[:invite_code],
      instance_api_url: api_v2_instance_url,
      inviter: {
        id: account.id.to_s,
        username: account.username,
        acct: account.acct,
        display_name: account.display_name,
        url: account.url,
      },
    }, status: 200
  end

  def personal
    doorkeeper_authorize! :read

    invite = current_resource_owner.invites.where(expires_at: nil, max_uses: nil).first

    if invite.nil?
      invite = current_resource_owner.invites.create!(
        expires_at: nil,
        max_uses: nil,
        autofollow: false
      )
    end

    # Pretty URL: `/@<username>/invite`. The classic `/invite/<code>`
    # route still works (backward compat + non-personal invites), but
    # the shareable URL we hand to the SPA is the pretty one so the
    # invitee sees who invited them right in the address bar.
    username = current_resource_owner.account.username
    render json: {
      code: invite.code,
      url: "https://#{Rails.configuration.x.local_domain}/@#{username}/invite",
    }
  end

  private

  def set_invite
    @invite = Invite.find_by!(code: params[:invite_code])
  end

  def check_valid_usage!
    render json: { error: I18n.t('invites.invalid') }, status: 401 unless @invite.valid_for_use?
  end

  def check_enabled_registrations!
    raise Mastodon::NotPermittedError unless allowed_registration?(request.remote_ip, @invite)
  end
end
