# frozen_string_literal: true

require 'rails_helper'
require 'mastodon/cli/korners'

RSpec.describe Mastodon::CLI::Korners do
  subject { cli.invoke(action, arguments, options) }

  let(:cli) { described_class.new }
  let(:arguments) { [] }
  let(:options) { {} }

  before { Kronk::KornerRegistry.reload! }

  it_behaves_like 'CLI Command'

  describe '#list' do
    let(:action) { :list }

    it 'prints a row for the kommons manifest' do
      expect { subject }.to output(/kommons/).to_stdout
    end
  end

  describe '#describe' do
    let(:action) { :describe }

    context 'with a known slug' do
      let(:arguments) { ['kommons'] }

      it 'dumps the manifest as YAML' do
        expect { subject }.to output(/slug: kommons/).to_stdout
      end
    end

    context 'with an unknown slug' do
      let(:arguments) { ['not-a-real-slug'] }

      it 'reports and exits non-zero' do
        expect { subject }.to raise_error(SystemExit) { |e| expect(e.status).to eq(1) }
          .and output(/No manifest found/).to_stdout
      end
    end
  end

  describe '#doctor' do
    let(:action) { :doctor }

    it 'prints the doctor header and exits' do
      # Exits 0 on clean state, 1 on drift — either is a valid outcome
      # depending on the test DB shape. We just verify it invokes cleanly.
      expect { subject }.to raise_error(SystemExit)
        .and output(/Korner framework doctor/).to_stdout
    end
  end

  # The URL check is the part that had to be tested by hand against a real
  # route table before it could be trusted: the first version passed
  # everything, because Rails' root catch-all matches every string you give
  # it. A check that cannot fail is worse than no check, since it reads as
  # coverage. These cases pin the behaviour that made it meaningful.
  describe 'node URL matching' do
    subject(:cli) { described_class.new }

    def match?(url, pattern)
      cli.send(:url_matches_pattern?, url, pattern)
    end

    it 'matches a literal path' do
      expect(match?('/explore', '/explore')).to be true
    end

    it 'treats differently-named params as equivalent' do
      # The registry writes /@:user/:id; the router writes /@:acct/:statusId.
      expect(match?('/@:user/:id', '/@:acct/:statusId')).to be true
    end

    it 'still requires the literal part of a segment to agree' do
      expect(match?('/@:user', '/:id')).to be false
    end

    it 'rejects a path with the wrong number of segments' do
      expect(match?('/publish/extra', '/publish')).to be false
      expect(match?('/publish', '/publish/:id')).to be false
    end

    it 'accepts an absent trailing optional param' do
      expect(match?('/@:user/tagged', '/@:acct/tagged/:tagged?')).to be true
    end

    it 'matches a prefix glob for anything beneath it' do
      expect(match?('/hub/kuestions/:id', '/hub/kuestions/*path')).to be true
    end

    it 'does not let a prefix glob match a different prefix' do
      expect(match?('/hub/kalendar/:id', '/hub/kuestions/*path')).to be false
    end

    it 'rejects a renamed route' do
      expect(match?('/explore-renamed', '/explore')).to be false
    end
  end

  # L10 (Korner Standard §3): a manifest may only declare notification types
  # that are actually registered, with a subject that resolves to a model.
  # Built on a synthetic manifest so it stays stable once the real Kommons
  # types are registered in Phase 5.7.
  describe 'L10 notification conformance' do
    subject(:cli) { described_class.new }

    def issues_for(notifications)
      manifest = Kronk::KornerRegistry::Manifest.new(
        slug: 'testkorner',
        enforced: true,
        security: { 'visibility_scopes' => %w(public) },
        notifications: notifications
      )
      cli.send(:detect_conformance_issues, manifest)
    end

    it 'flags a declared type that is not a registered Notification type' do
      issues = issues_for([{ 'name' => 'totally_made_up', 'subject_type' => 'proposal' }])
      expect(issues).to include(a_string_matching(/L10 notification type 'totally_made_up' is not registered/))
    end

    it 'accepts a registered type with a resolvable subject' do
      issues = issues_for([{ 'name' => 'proposal_status_changed', 'subject_type' => 'proposal' }])
      expect(issues).to all(satisfy { |line| line.exclude?('L10') })
    end

    it 'flags a registered type whose subject_type resolves to no model' do
      issues = issues_for([{ 'name' => 'proposal_status_changed', 'subject_type' => 'not_a_model' }])
      expect(issues).to include(a_string_matching(/L10 notification type 'proposal_status_changed' subject_type 'not_a_model' resolves to no model/))
    end

    it 'ignores notifications on a non-enforced manifest' do
      manifest = Kronk::KornerRegistry::Manifest.new(
        slug: 'testkorner', enforced: false,
        notifications: [{ 'name' => 'totally_made_up' }]
      )
      expect(cli.send(:detect_conformance_issues, manifest)).to all(satisfy { |line| line.exclude?('L10') })
    end
  end
end
