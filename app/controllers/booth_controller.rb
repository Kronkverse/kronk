# frozen_string_literal: true

class BoothController < ApplicationController
  include WebAppControllerConcern

  # Booth was inherited from upstream as a publicly viewable feature —
  # signed-out visitors could browse `/booth/sets/:id`. Kronk 2.0.0
  # closes that surface: Booth sets are member-only. `authenticate_user!`
  # bounces a signed-out visitor to `/auth/sign_in`. Note: removing the
  # `skip_before_action :require_functional!` alone (as #1097 did) was
  # not enough — `require_functional!` is guarded by
  # `if: :user_signed_in?` in ApplicationController, so it never fires
  # for signed-out visitors. The show view emits OG metadata (title,
  # artist, cover image) that would otherwise leak through link
  # unfurlers (Slack, Discord, WhatsApp) even without an SPA hydration.
  before_action :authenticate_user!

  content_security_policy only: :embed do |policy|
    policy.frame_ancestors(:any)
  end

  def index; end

  def show
    @booth_set = BoothSet.published.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    not_found
  end

  def embed
    @booth_set = BoothSet.published.find(params[:id])
    expires_in 180, public: true
    response.headers.delete('X-Frame-Options')
    render layout: false
  rescue ActiveRecord::RecordNotFound
    not_found
  end
end
