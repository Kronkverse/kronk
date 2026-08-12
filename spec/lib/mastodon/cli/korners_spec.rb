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

    it 'points an unregistered type at both escape hatches' do
      issues = issues_for([{ 'name' => 'totally_made_up' }]).join

      expect(issues).to match(/delivery: nudge/).and match(/planned: true/)
    end

    # `delivery: nudge` — the notification is carried on the Kronk::KornerEvents
    # bus rather than the legacy Notification store, so requiring registration
    # would report correct wiring as broken.
    context 'with delivery: nudge' do
      it 'accepts an event that is both published and consumed' do
        # albutts.album.new_photo: published by AlbumPhoto, consumed by the
        # hand-wired subscriber in nudges_event_bus.rb.
        issues = issues_for([{ 'name' => 'album_new_photo', 'delivery' => 'nudge', 'event' => 'albutts.album.new_photo' }])

        expect(issues).to all(satisfy { |line| line.exclude?('L10') })
      end

      it 'flags delivery: nudge with no event named' do
        expect(issues_for([{ 'name' => 'x', 'delivery' => 'nudge' }]))
          .to include(a_string_matching(/no `event:`/))
      end

      it 'flags an event nothing publishes' do
        expect(issues_for([{ 'name' => 'x', 'delivery' => 'nudge', 'event' => 'nobody.publishes.this' }]))
          .to include(a_string_matching(/nothing publishes/))
      end

      # huddle.started IS published by HuddleSession but nothing listens for it.
      # This is the "fires into the void" case and the reason the consumed half
      # of the check exists — without it, declaring a published-but-unheard
      # event would read as conformant.
      it 'flags an event that is published but consumed by nobody' do
        expect(issues_for([{ 'name' => 'x', 'delivery' => 'nudge', 'event' => 'huddle.started' }]))
          .to include(a_string_matching(/nothing consumes/))
      end
    end

    # `planned: true` — declared so the settings UI can offer the push toggle,
    # but nothing delivers it yet. Warning, never gating (mirrors L4 cards).
    context 'with planned: true' do
      def planned_warnings_for(notifications)
        manifest = Kronk::KornerRegistry::Manifest.new(
          slug: 'testkorner', enforced: true, notifications: notifications
        )
        cli.send(:detect_planned_notification_warnings, manifest)
      end

      it 'does not gate' do
        expect(issues_for([{ 'name' => 'totally_made_up', 'planned' => true }]))
          .to all(satisfy { |line| line.exclude?('L10') })
      end

      it 'warns instead' do
        expect(planned_warnings_for([{ 'name' => 'totally_made_up', 'planned' => true }]))
          .to include(a_string_matching(/declared planned/))
      end

      it 'stays silent for an entry that is not planned' do
        expect(planned_warnings_for([{ 'name' => 'proposal_status_changed' }])).to be_empty
      end
    end
  end

  # L11 (Korner Standard §3): the mounted feature file must not
  # duplicate the Frame's chrome slots. These pin the pattern-matching
  # behaviour of `frame_parasite_warnings` — the pure body of the
  # check, decoupled from ui/index.jsx and async-components.js lookups.
  describe 'L11 Frame parasite detection' do
    subject(:cli) { described_class.new }

    let(:manifest) do
      Kronk::KornerRegistry::Manifest.new(
        slug: 'testkorner',
        tagline: 'Celebrating the cycle which brought us all to this world.',
        views: [{ 'key' => 'mine', 'label' => 'Mine' }, { 'key' => 'circle', 'label' => 'Circle' }]
      )
    end

    def warnings_for(source, manifest_override = manifest)
      cli.send(:frame_parasite_warnings, manifest_override, source, 'features/testkorner/index.tsx')
    end

    it 'flags a top-level <h1> hero' do
      source = "return (<Stage><h1 className='hero'>TestKorner</h1></Stage>);"
      expect(warnings_for(source)).to include(a_string_matching(/L11 <h1>/))
    end

    it 'flags role="tablist" when the manifest declares views' do
      source = "<div role='tablist'><button role='tab'>Mine</button></div>"
      expect(warnings_for(source)).to include(a_string_matching(/L11 tab UI/))
    end

    it 'does not flag role="tablist" when the manifest has no views' do
      no_views = Kronk::KornerRegistry::Manifest.new(slug: 'testkorner', views: [])
      source = "<div role='tablist'></div>"
      expect(warnings_for(source, no_views)).to all(satisfy { |line| line.exclude?('L11 tab UI') })
    end

    it 'flags the tagline literal being inlined in the source' do
      source = '<p>Celebrating the cycle which brought us all to this world.</p>'
      expect(warnings_for(source)).to include(a_string_matching(/L11 tagline literal/))
    end

    it 'ignores the tagline literal when it appears only inside a block comment' do
      source = "/* Celebrating the cycle which brought us all to this world. */\n<div />"
      expect(warnings_for(source)).to all(satisfy { |line| line.exclude?('L11 tagline literal') })
    end

    it 'ignores the tagline literal when it appears only inside a line comment' do
      source = "// Celebrating the cycle which brought us all to this world.\n<div />"
      expect(warnings_for(source)).to all(satisfy { |line| line.exclude?('L11 tagline literal') })
    end

    it 'returns nothing for a clean Frame-adherent source' do
      source = <<~JSX
        export const K: React.FC = () => (
          <Stage label='TestKorner'><div className='testkorner'>content</div></Stage>
        );
      JSX
      expect(warnings_for(source)).to be_empty
    end

    it 'skips core spaces entirely' do
      core_manifest = Kronk::KornerRegistry::Manifest.new(
        slug: 'testcore', core: true, tagline: 'ignored', views: []
      )
      expect(cli.send(:detect_frame_parasites, core_manifest)).to be_empty
    end
  end

  # Composer conformance (docs/rebuild/decisions.md 2026-08-12): every
  # `*composer*.tsx` under `features/**/` must wrap in the shared
  # `<ComposeShell>` and not roll its own portal, openModal dispatch,
  # or local <ComposeFab>. These pin the pattern-matching body of the
  # check on synthetic source — decoupled from the real feature tree.
  describe 'composer conformance detection' do
    subject(:cli) { described_class.new }

    def warnings_for(source, rel_path = 'app/javascript/mastodon/features/testkorner/testkorner_composer.tsx')
      cli.send(:composer_conformance_warnings, source, rel_path)
    end

    it 'passes a clean ComposeShell-wrapped composer' do
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        export const TestkornerComposer: React.FC = () => (
          <ComposeShell korner='testkorner' label='Do the thing' submitLabel='Do' onSubmit={fn} onCancel={fn}>
            <div>fields</div>
          </ComposeShell>
        );
      JSX
      expect(warnings_for(source)).to be_empty
    end

    it 'flags a composer with no ComposeShell import' do
      source = "export const Composer = () => (<div className='my-composer'><form /></div>);"
      expect(warnings_for(source)).to include(a_string_matching(/no ComposeShell import/))
    end

    it 'flags a composer that calls createPortal directly' do
      source = <<~JSX
        import { createPortal } from 'react-dom';
        import { ComposeShell } from 'mastodon/components/compose_shell';
        export const Composer = () => createPortal(<ComposeShell />, document.body);
      JSX
      expect(warnings_for(source)).to include(a_string_matching(/createPortal directly/))
    end

    it 'flags a composer that dispatches openModal' do
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        export const Composer = () => {
          dispatch(openModal({ modalType: 'FOO' }));
          return <ComposeShell />;
        };
      JSX
      expect(warnings_for(source)).to include(a_string_matching(/dispatches openModal/))
    end

    it 'flags a composer that renders a local <ComposeFab>' do
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        import { ComposeFab } from 'mastodon/components/compose_fab';
        export const Composer = () => (
          <>
            <ComposeFab korner='testkorner' />
            <ComposeShell />
          </>
        );
      JSX
      expect(warnings_for(source)).to include(a_string_matching(/local <ComposeFab>/))
    end

    it 'does not flag createPortal / openModal / ComposeFab when only quoted in a block comment' do
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        /* Historical: was createPortal + openModal + <ComposeFab />. */
        export const Composer = () => (<ComposeShell />);
      JSX
      expect(warnings_for(source)).to be_empty
    end

    it 'does not flag ComposeFab appearing only as a plain word (no JSX)' do
      # `ComposeFab` in prose (a doc comment reference to the primitive)
      # should not be mistaken for a render. The check gates on the JSX
      # angle-bracket form.
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        // ComposeFab lives at components/compose_fab.tsx — no local render.
        export const Composer = () => (<ComposeShell />);
      JSX
      expect(warnings_for(source)).to be_empty
    end

    # The block-comment case above was covered from the start; a TRAILING line
    # comment was not, and used to survive `strip_jsx_comments` (which only
    # matched `^\s*//`). So the check fired on a developer's own note about
    # what they had removed.
    it 'does not flag a violation quoted in a trailing line comment' do
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        export const Composer = () => (<ComposeShell />); // was createPortal + openModal + <ComposeFab />
      JSX
      expect(warnings_for(source)).to be_empty
    end

    # Guards the guard: stripping line comments must not eat the rest of a
    # line after a URL in a string, or a real violation sitting after one
    # would go unreported — a false negative, which is the worse failure.
    it 'still flags a violation that follows a URL on the same line' do
      source = <<~JSX
        import { ComposeShell } from 'mastodon/components/compose_shell';
        import { ComposeFab } from 'mastodon/components/compose_fab';
        export const Composer = () => (<><a href='https://kronk.info/help' /><ComposeFab /><ComposeShell /></>);
      JSX
      expect(warnings_for(source)).to include(a_string_matching(/local <ComposeFab>/))
    end
  end
end
