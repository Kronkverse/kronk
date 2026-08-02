# frozen_string_literal: true

class BoothController < ApplicationController
  include WebAppControllerConcern

  # Booth was inherited from upstream as a publicly viewable feature —
  # signed-out visitors could browse `/booth/sets/:id`. Kronk 2.0.0
  # closes that surface: Booth sets are member-only. Sharing a set
  # link with a non-member now bounces them to sign_in. The `/embed`
  # variant also goes private for the same reason — non-members can't
  # iframe a set on an external page.
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
