# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::AttachmentSource do
  # Uses the real Event class (Kalendar) as the reference adopter — it
  # includes the concern in Phase 3. The Albutts side is stubbed to
  # keep the spec fast and isolated from Album's own validations.

  let(:account) { Fabricate(:account) }

  let(:event) do
    Event.create!(
      account: account,
      title: 'Test event',
      start_time: 2.days.from_now,
      end_time: 2.days.from_now + 2.hours,
      spawn_album: true
    )
  end

  let(:albutts_manifest) do
    instance_double(
      Kronk::KornerRegistry::Manifest,
      slug: 'albutts',
      attaches: [],
      accepts: [{ 'from' => 'kalendar', 'kind' => 'spawn' }]
    )
  end

  before do
    Kronk::KornerRegistry.reload!
    # The kalendar manifest ships with `attaches: [{to: albutts, kind:
    # spawn, trigger: field:spawn_album}, {to: booth, kind: link, ...}]`
    # as of this PR, so the concern will iterate them; we don't need to
    # stub the source manifest, but we do need Albutts' `accepts:` (the
    # spec block above already fabricates a synthetic one since the real
    # albutts manifest also gains `accepts:` in this PR).
    allow(Kronk::KornerRegistry).to receive(:find).and_call_original
    allow(Kronk::KornerRegistry).to receive(:model_for).and_call_original
  end

  describe 'spawn trigger on create' do
    it 'calls the registered factory and writes a spawn attachment row' do
      target_album = Album.create!(owner: account, title: 'spawned', visibility: :public)
      Kronk::AttachmentFactories.reset!
      Kronk::AttachmentFactories.register(
        source: 'kalendar', target: 'albutts', kind: 'spawn'
      ) { target_album }

      expect { event }.to change(KornerAttachment, :count).by(1)

      row = KornerAttachment.from_source('kalendar', event.id).first
      expect(row).to have_attributes(
        target_slug: 'albutts',
        target_id: target_album.id,
        kind: 'spawn',
        created_by_account_id: account.id
      )
    end

    it 'skips the spawn when the field is not truthy' do
      Kronk::AttachmentFactories.reset!
      Kronk::AttachmentFactories.register(source: 'kalendar', target: 'albutts', kind: 'spawn') { raise 'should not fire' }

      expect do
        Event.create!(
          account: account,
          title: 'No album',
          start_time: 3.days.from_now,
          end_time: 3.days.from_now + 1.hour,
          spawn_album: false
        )
      end.to_not change(KornerAttachment, :count)
    end

    it 'is idempotent when the same trigger fires twice (unique index)' do
      target_album = Album.create!(owner: account, title: 'once', visibility: :public)
      Kronk::AttachmentFactories.reset!
      Kronk::AttachmentFactories.register(source: 'kalendar', target: 'albutts', kind: 'spawn') { target_album }

      event
      expect { event.send(:fire_kronk_spawn_attachments) }
        .to_not change(KornerAttachment, :count)
    end
  end

  describe 'cascade on destroy' do
    it "destroys spawn attachments' target records + their join rows" do
      target_album = Album.create!(owner: account, title: 'to be destroyed', visibility: :public)
      Kronk::AttachmentFactories.reset!
      Kronk::AttachmentFactories.register(source: 'kalendar', target: 'albutts', kind: 'spawn') { target_album }

      event # trigger create + spawn

      expect { event.destroy }
        .to change(KornerAttachment, :count).by(-1)
        .and change(Album, :count).by(-1)
    end
  end
end
