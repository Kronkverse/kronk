# frozen_string_literal: true

# Previews of links to things on Kronk, for the person asking
# (Kronk::LinkPreview).
#
#   GET /api/v1/link_previews?urls[]=<url>&urls[]=<url>
#     → [{ url, preview: { korner, title, summary, image, when, url } | nil }]
#
# A preview is nil when the link isn't to something on Kronk, the thing is
# gone, or the person can't see it; the card then names only the korner.
class Api::V1::LinkPreviewsController < Api::BaseController
  MAX_URLS = 10

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  def index
    urls = Array(params[:urls]).map(&:to_s).compact_blank.uniq.first(MAX_URLS)
    render json: urls.map { |url| { url: url, preview: Kronk::LinkPreview.call(url, current_account) } }
  end
end
