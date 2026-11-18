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
    # Members only (authenticate_user! above), so a shared cache must never
    # keep it: private, not public.
    expires_in 180, public: false
    response.headers.delete('X-Frame-Options')
    render layout: false
  rescue ActiveRecord::RecordNotFound
    not_found
  end

  # A sample's file, saved rather than played (docs/spaces/booth.md,
  # Samples), for whoever its terms allow: anyone when it's free with
  # credit, on ask first whoever its maker said yes to. A web route, not the
  # API, so a plain link carries the session. Saved as its title, through a
  # short-lived signed URL as MediaController#download does.
  def download_sample
    sample = BoothSample.find(params[:id])
    return not_found if sample.account.blocking?(current_account) || !sample.usable_by?(current_account)

    media = sample.audio_attachment
    filename = "#{sample.title.parameterize.presence || "sample-#{sample.id}"}#{File.extname(media.file_file_name.to_s).downcase}"
    if media.file.respond_to?(:s3_object)
      disposition = ActionDispatch::Http::ContentDisposition.format(disposition: 'attachment', filename: filename)
      redirect_to media.file.s3_object(:original).presigned_url(:get, expires_in: 5.minutes.to_i, response_content_disposition: disposition), allow_other_host: true
    else
      send_file media.file.path(:original), filename: filename, disposition: 'attachment', type: media.file_content_type
    end
  rescue ActiveRecord::RecordNotFound
    not_found
  end
end
