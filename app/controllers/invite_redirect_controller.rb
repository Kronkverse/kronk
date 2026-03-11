# frozen_string_literal: true

class InviteRedirectController < ApplicationController
  skip_before_action :require_functional!, only: [:show]

  def show
    invite = Invite.find_by(code: params[:invite_code])

    if user_signed_in? && invite&.valid_for_use?
      redirect_to short_account_path(invite.user.account)
    elsif invite&.valid_for_use?
      redirect_to public_invite_path(invite_code: invite.code)
    else
      redirect_to root_path
    end
  end
end
