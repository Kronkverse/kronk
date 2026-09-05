# frozen_string_literal: true

# Feed display preferences (settings rebuild §7; settings.feed node). How the
# incoming timeline renders — the "what reaches you, and how it looks" half of
# the Feed surface. Sibling of the scope + tune-in controls that already live
# in the feed_settings page. See docs/kronk_settings_ia.md.
#
#   GET  /api/v1/settings/feed  => { settings_schema: [...], values: {...} }
#   PUT  /api/v1/settings/feed  body: { group_boosts: false } (partial)
#
# Schema-driven so the SPA renders it with the shared settings widgets.
class Api::V1::Settings::FeedController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  # Trimmed 2026-09-05 (Tal): `slow_mode`, `blur_media`,
  # `expand_content_warnings`, `show_trends` retired from this
  # surface. They were legacy Mastodon primitives that either didn't
  # map to Kronk behaviour (trends, slow-mode) or duplicated a
  # neighbour (`blur_media` overlapped `media_display`'s hide_all).
  # The underlying user_setting rows (web.use_pending_items,
  # web.use_blurhash, web.expand_content_warnings, web.trends) are
  # NOT touched — this only stops surfacing them for edit; existing
  # values keep round-tripping through the standard settings path.
  FIELDS = {
    'group_boosts' => { key: 'aggregate_reblogs', kind: 'boolean', options: -> {} },
    'media_display' => { key: 'web.display_media', kind: 'enum', options: -> { %w(default show_all hide_all) } },
    # Moments home-strip visibility (Tal 2026-09-05). The manifest at
    # config/korners/moments.yaml also declares `strip_on_home`, but
    # the framework's per-korner settings endpoint isn't yet wired to
    # a UI — the Feed page is the natural home since the strip lives
    # on the home feed. Stored on the user_settings hash so
    # <MomentsStrip> gates on it via /api/v1/settings/feed. Default
    # `true` — the strip is on for everyone until they opt out.
    'moments_strip_on_home' => { key: 'web.moments_strip_on_home', kind: 'boolean', options: -> {} },
  }.freeze

  def show
    render json: payload
  end

  def update
    updates = {}

    FIELDS.each do |name, cfg|
      next unless params.key?(name)

      value = coerce(cfg[:kind], params[name])

      return render json: { error: "invalid value for #{name}" }, status: 422 if cfg[:kind] == 'enum' && cfg[:options].call.exclude?(value)

      updates[cfg[:key]] = value
    end

    begin
      current_user.settings.update(updates) if updates.any?
      current_user.save!
    rescue ArgumentError => e
      return render json: { error: e.message }, status: 422
    end

    render json: payload
  end

  private

  def coerce(kind, raw)
    kind == 'boolean' ? ActiveModel::Type::Boolean.new.cast(raw) : raw.to_s
  end

  def payload
    {
      settings_schema: FIELDS.map do |name, cfg|
        schema = { name: name, kind: cfg[:kind] }
        options = cfg[:options].call
        schema[:options] = options unless options.nil?
        schema
      end,
      values: {
        'group_boosts' => current_user.settings['aggregate_reblogs'],
        'media_display' => current_user.settings['web.display_media'],
        # Default `true` when the setting hasn't been written yet
        # (fresh accounts) — the strip is on out of the box. `nil`
        # here means "never toggled"; explicit `false` is preserved.
        'moments_strip_on_home' => current_user.settings['web.moments_strip_on_home'] != false,
      },
    }
  end
end
