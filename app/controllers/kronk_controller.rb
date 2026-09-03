# frozen_string_literal: true

# /kronk/* — the Kronk organisation space per spec §O. Serves markdown
# pages from content/kronk/ with a plain Rails view wrapper. Content
# is versioned in the repo; instance operators fork and edit the
# instance-layer files (privacy, terms, contact, rules) for their
# deployment.

require 'redcarpet'

class KronkController < ApplicationController
  layout 'application'

  # These pages are static markdown with no form on them, so an anonymous
  # visitor has no reason to receive a session cookie or an uncacheable
  # response — and `/about` and `/privacy-policy` redirect here, which
  # makes them the first pages a logged-out visitor sees.
  #
  # Two things were inherited from `ApplicationController` and are wrong
  # here. Its `skip_csrf_meta_tags?` returns `false`, so the layout emits
  # `csrf_meta_tags` for everyone; generating that token writes the
  # session, which sets `_mastodon_session` and makes the response
  # uncacheable (upstream fixed the same class of bug in
  # "Fix anonymous visitors getting a session cookie on first visit",
  # #24584, and `WebAppControllerConcern` carries that fix — this
  # controller does not include it). And `set_cache_control_defaults`
  # marks every response `private, no_store`, which is right for a
  # member's page and wrong for a public one.
  #
  # `vary_by` keeps the anonymous cache from ever being served to a
  # signed-in member: `enforce_cache_control!` (CacheConcern) downgrades
  # the response back to `private, no_store` as soon as a Cookie header
  # is actually present on the request.
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

  before_action :set_page_key
  before_action :load_navigation
  before_action :load_content

  # The nav lists every top-level `.md` file that ships in content/kronk.
  # Ops can drop new pages in — they'll appear in the sidebar without a
  # code change. Order matches the recommended reading flow.
  NAV_ORDER = %w(about announcements values contributors governance rules privacy terms contact).freeze

  def show; end

  # The layout asks this before emitting `csrf_meta_tags`. Anonymous
  # visitors get no token (and so no session cookie); signed-in members
  # get one exactly as before. Mirrors `WebAppControllerConcern`, minus
  # the single-provider SSO branch, which has no bearing on a static
  # page with no login form.
  def skip_csrf_meta_tags?
    current_user.nil?
  end

  private

  def set_public_cache_headers
    return if user_signed_in?

    expires_in(3.minutes, public: true, stale_while_revalidate: 30.seconds, stale_if_error: 1.day)
  end

  def set_page_key
    @page_key = params[:page].presence || 'about'

    return if PAGE_PATTERN.match?(@page_key)

    @page_key = 'about'
  end

  def load_navigation
    keys = CONTENT_ROOT.glob('*.md').map { |p| p.basename('.md').to_s }
    @nav_pages = NAV_ORDER.select { |k| keys.include?(k) } + (keys - NAV_ORDER)
  end

  def load_content
    path = CONTENT_ROOT.join("#{@page_key}.md")

    if path.file?
      raw = path.read
      @title, @body_html = render_markdown(raw)
    else
      @title = 'Page not found'
      # @page_key is filtered by PAGE_PATTERN in set_page_key — safe to interpolate.
      @body_html = "<p>No content at <code>/kronk/#{@page_key}</code> yet.</p>".html_safe # rubocop:disable Rails/OutputSafety
      response.status = 404
    end
  end

  def render_markdown(raw)
    frontmatter, body = split_frontmatter(raw)
    title = frontmatter['title'] || @page_key.humanize
    html  = MARKDOWN.render(body.to_s)
    # Markdown source ships with the repo under content/kronk/*.md — trusted, not user input.
    [title, html.html_safe] # rubocop:disable Rails/OutputSafety
  end

  # Optional YAML frontmatter: --- ... --- at the top of the file.
  # `permitted_classes: [Date]` because content pages carry `updated: YYYY-MM-DD`.
  def split_frontmatter(raw)
    return [{}, raw] unless raw.start_with?("---\n")

    _, frontmatter, body = raw.split(/^---\s*$/, 3)
    [YAML.safe_load(frontmatter.to_s, permitted_classes: [Date]) || {}, body.to_s]
  rescue Psych::SyntaxError, Psych::DisallowedClass
    [{}, raw]
  end
end
