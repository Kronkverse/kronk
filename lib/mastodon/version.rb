# frozen_string_literal: true

# The upstream Mastodon release this fork is level with.
#
# Held at 4.5.9 until 2026-09-16, when it moved to 4.5.18 — not because
# the whole of 4.5.18 was merged, but because every security commit up
# to and including it was cherry-picked (#1900 / #1902): the four
# releases' worth of fixes in 4.5.10, 4.5.11, 4.5.15 and 4.5.17, from
# the SSRF and JSON-LD hardening through to the three September
# advisories.
#
# Leaving it at 4.5.9 had a cost that was not obvious until an admin saw
# it: Mastodon's own update checker compares THIS string against the
# upstream release feed, so every staff member was shown "Critical
# security update available!" on a server that already carried those
# fixes. A false alarm that cannot be dismissed is worse than no alarm —
# it teaches people to scroll past the banner that will one day be real.
#
# What this claims, precisely: security parity with 4.5.18. What it does
# NOT claim is the rest of it — three bugfixes (canonical email blocks,
# annual report deletion, bulk notification-request cleanup), the
# dependency bumps, and upstream's move to Rails 8.1.2. That last one is
# the Rails EOL work due before 2026-10-07, and completing the merge to
# 4.5.18 is how it gets done; when that lands, this comment goes and the
# number simply means what it says.
#
# The alarm still works. A 4.5.19 with a security fix is greater than
# this, so the checker will flag it exactly as it should.
module Mastodon
  module Version
    module_function

    def major
      4
    end

    def minor
      5
    end

    def patch
      18
    end

    def default_prerelease
      ''
    end

    def prerelease
      version_configuration[:prerelease].presence || default_prerelease
    end

    def build_metadata
      version_configuration[:metadata]
    end

    def to_a
      [major, minor, patch].compact
    end

    def to_s
      components = [to_a.join('.')]
      components << "-#{prerelease}" if prerelease.present?
      components << "+#{build_metadata}" if build_metadata.present?
      components.join
    end

    # The upstream release this build is level with, as a comparable
    # version — deliberately WITHOUT Kronk's own prerelease label.
    #
    # Kronk stamps its release train into MASTODON_VERSION_PRERELEASE
    # (`kronk.2.0.0-alpha`), so `to_s` reads `4.5.18-kronk.2.0.0-alpha`,
    # which RubyGems parses as `4.5.18.pre.kronk…` — a PRERELEASE of
    # 4.5.18, and therefore OLDER than 4.5.18.
    #
    # `SoftwareUpdate` compares this against the upstream release feed,
    # so with the suffix included every Kronk build reads as one release
    # behind whatever it claims, and the "Critical security update
    # available!" banner can never clear. Bumping 4.5.9 → 4.5.18 on
    # 2026-09-16 didn't shift it for exactly this reason: the patch
    # number was never the problem.
    #
    # major.minor.patch is the upstream identity; the suffix is Kronk's
    # own versioning and says nothing about upstream. Compare on the
    # former, and the checker starts telling the truth in both
    # directions — silent when we are level, loud when 4.5.19 lands.
    def gem_version
      @gem_version ||= Gem::Version.new(to_a.join('.'))
    end

    def api_versions
      {
        mastodon: 7,
      }
    end

    def repository
      source_configuration[:repository]
    end

    def source_base_url
      source_configuration[:base_url] || "https://github.com/#{repository}"
    end

    # specify git tag or commit hash here
    def source_tag
      source_configuration[:tag]
    end

    def source_url
      if source_tag
        "#{source_base_url}/tree/#{source_tag}"
      else
        source_base_url
      end
    end

    def source_commit
      ENV.fetch('SOURCE_COMMIT', nil)
    end

    def user_agent
      @user_agent ||= "Mastodon/#{Version} (#{HTTP::Request::USER_AGENT}; +http#{'s' if Rails.configuration.x.use_https}://#{Rails.configuration.x.web_domain}/)"
    end

    def version_configuration
      mastodon_configuration.version
    end

    def source_configuration
      mastodon_configuration.source
    end

    def mastodon_configuration
      Rails.configuration.x.mastodon
    end
  end
end
