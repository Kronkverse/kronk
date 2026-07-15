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

  FIELDS = {
    'group_boosts' => { key: 'aggregate_reblogs', kind: 'boolean', options: -> {} },
    'slow_mode' => { key: 'web.use_pending_items', kind: 'boolean', options: -> {} },
    'media_display' => { key: 'web.display_media', kind: 'enum', options: -> { %w(default show_all hide_all) } },
    'blur_media' => { key: 'web.use_blurhash', kind: 'boolean', options: -> {} },
    'expand_content_warnings' => { key: 'web.expand_content_warnings', kind: 'boolean', options: -> {} },
    'show_trends' => { key: 'web.trends', kind: 'boolean', options: -> {} },
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
        'slow_mode' => current_user.settings['web.use_pending_items'],
        'media_display' => current_user.settings['web.display_media'],
        'blur_media' => current_user.settings['web.use_blurhash'],
        'expand_content_warnings' => current_user.settings['web.expand_content_warnings'],
        'show_trends' => current_user.settings['web.trends'],
      },
    }
  end
end
