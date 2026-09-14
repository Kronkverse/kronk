# frozen_string_literal: true

# JSON face of the /kronk org space. The SPA fetches from here; the
# Rails `KronkController` now just boots the SPA shell.
#
#   GET /api/v1/kronk_pages          => the `about` page (default)
#   GET /api/v1/kronk_pages/:page    => any markdown file under content/kronk/
#
# Response:
#   { page: 'about', title: 'About Kronk', body_html: '<h2>...</h2>',
#     nav_pages: [{ slug: 'about', label: 'About' }, ...] }
#
# nav_pages is included in every response so the SPA-side wheel can
# render on first paint without a second call. `body_html` is
# pre-rendered server-side because the SPA has no Markdown runtime;
# the renderer's `safe_links_only: true` blocks javascript: URLs and
# the source is repo-versioned Markdown (trusted).
class Api::V1::KronkPagesController < Api::BaseController
  # Public content. Signed-in status is irrelevant; anonymous readers
  # (federated crawlers, direct links, signed-out members reading the
  # org space via the SPA shell) must reach these pages. Base's
  # `require_authenticated_user!` only fires when the instance
  # disallows unauthenticated API access — this skip keeps /kronk
  # readable regardless of that instance-level setting.
  skip_before_action :require_authenticated_user!, raise: false

  # Cache the payload for the same 3-minute window `KronkController`
  # previously carried on the HTML response — the content changes at
  # commit-cadence, not per-request.
  before_action :set_public_cache_headers

  CONTENT_ROOT = KronkController::CONTENT_ROOT
  PAGE_PATTERN = KronkController::PAGE_PATTERN
  NAV_ORDER    = KronkController::NAV_ORDER
  MARKDOWN     = KronkController::MARKDOWN

  def show
    page_key = normalize_page(params[:page])
    path = CONTENT_ROOT.join("#{page_key}.md")

    if path.file?
      title, body_html = render_markdown(page_key, path.read)
      render json: {
        page: page_key,
        title: title,
        body_html: body_html,
        nav_pages: nav_pages,
      }
    else
      render json: { error: "no content at /kronk/#{page_key}" }, status: 404
    end
  end

  private

  def set_public_cache_headers
    return if user_signed_in?

    expires_in(3.minutes, public: true, stale_while_revalidate: 30.seconds, stale_if_error: 1.day)
  end

  def normalize_page(raw)
    key = raw.presence || 'about'
    PAGE_PATTERN.match?(key) ? key : 'about'
  end

  # Order matches the Rails controller: hardcoded reading flow first,
  # everything else alphabetically after. Any .md dropped into
  # content/kronk/ shows up in the SPA wheel without a code change.
  def nav_pages
    keys = CONTENT_ROOT.glob('*.md').map { |p| p.basename('.md').to_s }
    ordered = NAV_ORDER.select { |k| keys.include?(k) } + (keys - NAV_ORDER)
    ordered.map { |slug| { slug: slug, label: slug.humanize } }
  end

  def render_markdown(page_key, raw)
    frontmatter, body = split_frontmatter(raw)
    title = frontmatter['title'] || page_key.humanize
    html  = MARKDOWN.render(body.to_s)
    [title, html]
  end

  def split_frontmatter(raw)
    return [{}, raw] unless raw.start_with?("---\n")

    _, frontmatter, body = raw.split(/^---\s*$/, 3)
    [YAML.safe_load(frontmatter.to_s, permitted_classes: [Date]) || {}, body.to_s]
  rescue Psych::SyntaxError, Psych::DisallowedClass
    [{}, raw]
  end
end
