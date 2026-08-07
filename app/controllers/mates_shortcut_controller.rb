# frozen_string_literal: true

# /mates — friendlier entry to the Mates timeline (which lives at the
# per-account URL `/@:handle/mates`). Redirects the signed-in user to
# their own timeline. Unsigned visitors bounce to sign-in via
# `authenticate_user!`.
class MatesShortcutController < ApplicationController
  before_action :authenticate_user!

  def show
    redirect_to short_account_mates_path(username: current_user.account.username)
  end
end
