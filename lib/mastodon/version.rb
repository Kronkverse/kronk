# frozen_string_literal: true

# The upstream Mastodon release this fork is level with.
#
# Held at 4.5.9 until 2026-09-16, when it moved to 4.5.18 — not because
# the whole of 4.5.18 was merged, but because every security commit up
# to and including it was cherry-picked in 1.7.5 (#1902): the fixes from
# 4.5.10, 4.5.11, 4.5.15 and 4.5.17, covering the SSRF and JSON-LD
# hardening through to the three September advisories.
#
# Leaving it at 4.5.9 had a cost that only shows from the admin's side:
# Mastodon's update checker compares THIS string against the upstream
# release feed, so staff were shown "Critical security update
# available!" on a server that already carried those fixes. A false
# alarm nobody can clear is worse than no alarm — it teaches people to
# scroll past the banner that will one day be real.
#
# What this claims is security parity with 4.5.18. What it does NOT
# claim is the rest of it: three bugfixes, the dependency bumps, and
# upstream's move to Rails 8.1.2 — the EOL work due before 2026-10-07.
#
# The alarm still works: a 4.5.19 carrying a security fix is greater
# than this, and will be flagged exactly as it should be.
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

    def gem_version
      @gem_version ||= Gem::Version.new(to_s.split('+')[0])
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
