# frozen_string_literal: true

class UserSettings
  class Error < StandardError; end
  class KeyError < Error; end

  include UserSettings::DSL
  include UserSettings::Glue

  setting :always_send_emails, default: false
  setting :aggregate_reblogs, default: true
  setting :theme, default: -> { ::Setting.theme }
  setting :noindex, default: -> { ::Setting.noindex }
  setting :show_application, default: true
  setting :default_language, default: nil
  setting :default_sensitive, default: false
  setting :default_privacy, default: nil, in: %w(public unlisted private mates orbit self_only)
  setting :default_quote_policy, default: 'public', in: %w(public followers nobody)

  setting_inverse_alias :indexable, :noindex

  namespace :web do
    setting :advanced_layout, default: false
    setting :trends, default: true
    setting :use_blurhash, default: true
    setting :use_pending_items, default: false
    setting :use_system_font, default: false
    setting :use_system_scrollbars, default: false
    setting :disable_swiping, default: false
    setting :disable_hover_cards, default: false
    setting :delete_modal, default: true
    setting :reblog_modal, default: false
    setting :quick_boosting, default: false
    setting :missing_alt_text_modal, default: true
    setting :reduce_motion, default: false
    setting :expand_content_warnings, default: false
    setting :display_media, default: 'default', in: %w(default show_all hide_all)
    setting :auto_play, default: false
    setting :emoji_style, default: 'auto', in: %w(auto native twemoji)
    # Kronk Personal Appearance — per-user token overrides layered over the
    # brand defaults. personal_accent is a purple hex (hue-clamped in the
    # appearance controller, not via `in:`); the rest are enum keys the
    # client maps to font stacks / a UI scale factor. 'default' = inherit the
    # brand token (no override).
    setting :personal_accent, default: nil
    # Purple hue slider — nil means "use the anchor palette"; otherwise
    # an integer 260-310 rotates the whole --kronk-purple-* family
    # around a shared L+C anchor (see docs/kronk_aesthetic_system.md).
    # Range enforced by the appearance controller, not `in:`.
    setting :personal_purple_hue, default: nil
    setting :personal_font_display, default: 'default', in: %w(default playfair fraunces cormorant lora merriweather garamond spectral)
    setting :personal_font_body, default: 'default', in: %w(default inter ibm-plex manrope work-sans dm-sans figtree system)
    setting :ui_scale, default: 'default', in: %w(small default large xl)
  end

  namespace :notification_emails do
    setting :follow, default: true
    setting :reblog, default: false
    setting :favourite, default: false
    setting :mention, default: true
    setting :quote, default: true
    setting :follow_request, default: true
    setting :report, default: true
    setting :pending_account, default: true
    setting :trends, default: true
    setting :appeal, default: true
    setting :event_invitation, default: true
    setting :software_updates, default: 'critical', in: %w(none critical patch all)
  end

  namespace :interactions do
    # must_be_follower and must_be_following were retired 2026-07-23 —
    # both settings were writeable but no code path read them, so the
    # toggles did nothing. must_be_following_dm is the one live gate
    # (backed by the /settings/privacy dm_followers_only surface).
    setting :must_be_following_dm, default: false
  end

  # Kronk feed reach: how wide a slice of the network the home column
  # shows. The three tiers are the Mates → Orbit → Kommunity distance
  # scale from docs/kronk_feed_and_reach.md §2.1. Default is Orbit
  # (Mates + Mates-of-Mates) — a middle ring, not a walled garden and
  # not the whole instance. Persists here; the timeline enforcement
  # gate lands behind Kronk::FeatureFlags.feed_scope_enforced.
  #
  # Legacy values `friends | friends_of_friends` may still be present
  # in existing user hashes; the API controller translates them on
  # read and any subsequent write normalises the stored value.
  namespace :kronk do
    setting :feed_scope, default: 'orbit', in: %w(mates orbit kommunity)
  end

  def initialize(original_hash)
    @original_hash = original_hash || {}
  end

  def [](key)
    definition = self.class.definition_for(key)

    raise KeyError, "Undefined setting: #{key}" if definition.nil?

    definition.value_for(key, @original_hash[definition.key])
  end

  def []=(key, value)
    definition = self.class.definition_for(key)

    raise KeyError, "Undefined setting: #{key}" if definition.nil?

    typecast_value = definition.type_cast(value)

    raise ArgumentError, "Invalid value for setting #{definition.key}: #{typecast_value}" if definition.in.present? && definition.in.exclude?(typecast_value)

    if typecast_value.nil?
      @original_hash.delete(definition.key)
    else
      @original_hash[definition.key] = definition.value_for(key, typecast_value)
    end
  end

  def update(params)
    params.each do |k, v|
      self[k] = v unless v.nil?
    end
  end

  keys.each do |key|
    define_method(key) do
      self[key]
    end
  end

  def as_json
    @original_hash
  end
end
