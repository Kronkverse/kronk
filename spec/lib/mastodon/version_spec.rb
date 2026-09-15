# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Mastodon::Version do
  describe '.gem_version' do
    # Kronk labels its own release train in MASTODON_VERSION_PRERELEASE.
    # Left in the comparable version, RubyGems reads `4.5.18-kronk.x` as a
    # prerelease OF 4.5.18 — i.e. older than it — so the update checker
    # reports a critical update on a server that is level with upstream,
    # and no patch number can clear it. See the note on .gem_version.
    around do |example|
      described_class.instance_variable_set(:@gem_version, nil)
      example.run
      described_class.instance_variable_set(:@gem_version, nil)
    end

    it 'ignores the Kronk prerelease label' do
      allow(described_class).to receive(:prerelease).and_return('kronk.2.0.0-alpha')

      expect(described_class.gem_version).to eq Gem::Version.new(described_class.to_a.join('.'))
      expect(described_class.gem_version).to_not be_prerelease
    end

    it 'does not read as older than the upstream release of the same number' do
      allow(described_class).to receive(:prerelease).and_return('kronk.2.0.0-alpha')

      expect(described_class.gem_version).to be >= Gem::Version.new(described_class.to_a.join('.'))
    end

    it 'still reads as older than the next upstream patch' do
      allow(described_class).to receive(:prerelease).and_return('kronk.2.0.0-alpha')
      major, minor, patch = described_class.to_a

      expect(described_class.gem_version).to be < Gem::Version.new([major, minor, patch + 1].join('.'))
    end
  end
end
