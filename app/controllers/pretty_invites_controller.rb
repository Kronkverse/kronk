# frozen_string_literal: true

# Kronk invite URLs are pretty: `/@<username>/invite` (Tal invited me →
# `/@tal/invite`). Under the hood they still resolve to a personal
# Invite row on the inviter's User; this shim looks up (or creates) the
# evergreen personal invite for the named account and redirects to the
# classic `/invite/<code>` path, where the existing signup flow takes
# over.
#
# Why redirect rather than serve inline: the four-step signup flow
# (welcome → rules → privacy → details) advances through the same
# `/invite/<code>?welcomed=…&accept=…&privacy_accepted=…` URL shape.
# Redirecting once at the front door means the step transitions don't
# need to know about the pretty URL — one code path, not two.
#
# Anyone can hit this — no auth gate. The whole point of an invite link
# is that a non-member follows it.
class PrettyInvitesController < ApplicationController
  skip_before_action :require_functional!
  skip_before_action :check_self_destruct!

  def show
    account = Account.find_by(username: params[:account_username], domain: nil)
    return not_found if account.nil? || account.unavailable?

    user = account.user
    return not_found if user.nil?

    invite = user.invites.where(expires_at: nil, max_uses: nil).first
    invite ||= user.invites.create!(expires_at: nil, max_uses: nil, autofollow: false)

    redirect_to public_invite_path(invite_code: invite.code), status: 302
  end
end
