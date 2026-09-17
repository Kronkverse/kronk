# frozen_string_literal: true

module Kronk
  # Tells the old Android app, in the only channel it has, that Kronk has
  # moved to the web.
  #
  # The app cannot be reasoned with any other way. It has no announcements
  # support — no `/api/v1/announcements` call exists anywhere in it — so a
  # server-posted notice cannot reach anyone. What it does do is send
  # `User-Agent: MastodonAndroid/<version>` and surface the `error` field of
  # a failed API call to the person holding the phone. So that is the
  # channel: answer its API calls with a message instead of data.
  #
  # Why it has to say something rather than quietly work: after the 2.0
  # migrations remap posts onto the reach ladder, every build out there
  # crashes on the timeline. `StatusPrivacy` knows four constants, GSON maps
  # `mates` / `orbit` / `self_only` to null, and the footer switches on it
  # with no default. A silent server is a phone that force-closes with no
  # explanation; this way the person gets a sentence telling them where to
  # go.
  #
  # Scope is deliberately narrow:
  #   * `/api/` only — web pages, deep links and `/oauth` are untouched, so
  #     a tapped link still opens something useful.
  #   * Gated behind the `legacy_app_gate` feature flag, so it is one line
  #     to turn off.
  #   * **A client that identifies itself as Kronk is never gated.** This is
  #     the contract for the replacement app: pick a `Kronk…` user agent and
  #     the gate ignores you, with no env var to remember and no version
  #     arithmetic. It matters because the 2.0 app is a fresh rewrite of a
  #     Mastodon client, and the thing it forked from sends
  #     `MastodonAndroid/` — keep that string and the server would turn away
  #     the very app this gate exists to make room for.
  #   * `LEGACY_APP_MIN_VERSION` is the fallback for a replacement that
  #     cannot change its user agent. Set it to the first good version and
  #     older builds stay gated. Prefer the user agent: version-gating can
  #     only separate old from new if every install already out there is
  #     strictly lower, which is not true the moment two builds share a
  #     version number.
  class LegacyAppGate
    USER_AGENT = %r{\AMastodonAndroid/(?<version>\d+(?:\.\d+)*)}

    # Anything announcing itself as a Kronk client is ours and current.
    # Matched before USER_AGENT so it wins even if a build carries both
    # names (e.g. "KronkAndroid/1.0 (MastodonAndroid/2.12.0)").
    KRONK_CLIENT = /\AKronk/i

    GATED_PATH = '/api/'

    MESSAGE = 'Kronk has moved to the web. Open kronk.info in your browser and add it to your home screen — everything is there, and the app is being replaced.'

    def initialize(app)
      @app = app
    end

    def call(env)
      return @app.call(env) unless gate?(env)

      [
        410,
        {
          'Content-Type' => 'application/json; charset=utf-8',
          'X-Kronk-Legacy-Client' => 'gated',
        },
        [Oj.dump({ error: MESSAGE }, mode: :compat)],
      ]
    end

    private

    def gate?(env)
      return false unless env['PATH_INFO'].to_s.start_with?(GATED_PATH)
      return false unless Kronk::FeatureFlags.enabled?(:legacy_app_gate)

      agent = env['HTTP_USER_AGENT'].to_s
      return false if KRONK_CLIENT.match?(agent)

      match = USER_AGENT.match(agent)
      return false if match.nil?

      !new_enough?(match[:version])
    end

    # A client is let through when it declares a version at or above
    # LEGACY_APP_MIN_VERSION. Unset means every Android build is gated,
    # which is the correct default while no replacement exists.
    def new_enough?(version)
      minimum = ENV.fetch('LEGACY_APP_MIN_VERSION', '').strip
      return false if minimum.empty?

      Gem::Version.new(version) >= Gem::Version.new(minimum)
    rescue ArgumentError
      false
    end
  end
end
