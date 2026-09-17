# frozen_string_literal: true

# /kronk/* — the Kronk organisation space per spec §O.
#
# Before 2026-09-14 this controller rendered the org pages directly (a
# Rails view built from Redcarpet-rendered Markdown under
# content/kronk/). That view carried its own Haml-mirror chrome —
# a parallel of `KronkFrame`/`HubSwitcher`/`KornerSidebar`/
# `KronkMenu`/`KronkKosmos` with no shared source, no drift doctor,
# and no way to keep parity as the SPA evolved.
#
# Since 2026-09-14 the space is a real SPA route
# (`features/kronk_org/index.tsx`) mounted inside the same
# `KronkFrame` every other space uses. This controller now just boots
# the SPA shell for the /kronk/* URLs; the SPA calls
# `GET /api/v1/kronk_pages(/:page)` to fetch the rendered Markdown.
#
# The public-cache posture from the old direct-render setup is
# preserved: anonymous visitors get no session cookie
# (`skip_csrf_meta_tags?` returns true when signed out), the response
# is `expires_in 3.minutes, public: true`, and `vary_by 'Accept-
# Language, Cookie'` protects the anonymous cache from ever being
# served to a signed-in member. First-paint speed for federated
# crawlers and direct links from other instances stays intact — they
# get the SPA shell over the CDN, and modern crawlers render the
# JS-hydrated content.
#
# The Markdown-rendering constants below stay here because
# `Api::V1::KronkPagesController` reads them — the content root, URL
# regex, nav order and the Redcarpet renderer are shared.
require 'redcarpet'

class KronkController < ApplicationController
  layout 'application'

  vary_by 'Accept-Language, Cookie'

  before_action :set_public_cache_headers

  CONTENT_ROOT = Rails.root.join('content', 'kronk').freeze
  PAGE_PATTERN = %r{\A[a-z0-9-]+(?:/[a-z0-9-]+)?\z}

  # Reused across requests — Redcarpet renderers are thread-safe once
  # constructed. `safe_links_only` blocks javascript: URLs; markdown
  # content itself is in-repo so we don't need `filter_html`.
  MARKDOWN = Redcarpet::Markdown.new(
    Redcarpet::Render::HTML.new(hard_wrap: false, safe_links_only: true, no_styles: true),
    autolink: true,
    fenced_code_blocks: true,
    tables: true,
    strikethrough: true
  )

  # The nav lists every top-level `.md` file that ships in content/kronk.
  # Ops can drop new pages in — they'll appear in the SPA wheel without a
  # code change. Order matches the recommended reading flow.
  # Consolidated 2026-09-15: `announcements` retired, `values` folded
  # into `about`, `contact` folded into `contributors`. Pages that
  # remain, in reading-flow order.
  NAV_ORDER = %w(about how-it-works contributors governance rules privacy terms).freeze

  def show; end

  # The layout asks this before emitting `csrf_meta_tags`. Anonymous
  # visitors get no token (and so no session cookie); signed-in members
  # get one exactly as before.
  def skip_csrf_meta_tags?
    current_user.nil?
  end

  private

  def set_public_cache_headers
    return if user_signed_in?

    expires_in(3.minutes, public: true, stale_while_revalidate: 30.seconds, stale_if_error: 1.day)
  end
end
