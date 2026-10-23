# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::AttachmentSource do
  # Uses the real Event class (Kalendar) as the reference adopter. No
  # korner spawns today (Kalendar's "spawn an album" was retired
  # 2026-10-23), so both manifests are stubbed with a spawn pair keyed on
  # a boolean Event already has.

  let(:account) { Fabricate(:account) }

  let(:event) do
    Event.create!(
      account: account,
      title: 'Test event',
      start_time: 2.days.from_now,
      end_time: 2.days.from_now + 2.hours,
      invite_only: true
    )
  end

  let(:kalendar_manifest) do
    instance_double(
      Kronk::KornerRegistry::Manifest,
      slug: 'kalendar',
      attaches: [{ 'to' => 'albutts', 'kind' => 'spawn', 'trigger' => 'field:invite_only' }],
      accepts: []
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
    allow(Kronk::KornerRegistry).to receive(:find).and_call_original
    allow(Kronk::KornerRegistry).to receive(:model_for).and_call_original
    allow(Kronk::KornerRegistry).to receive(:find).with('kalendar').and_return(kalendar_manifest)
    allow(Kronk::KornerRegistry).to receive(:find).with('albutts').and_return(albutts_manifest)
    # The stubbed manifests have no resources, so say which model each is.
    allow(Kronk::KornerRegistry).to receive(:model_for).with('kalendar').and_return(Event)
    allow(Kronk::KornerRegistry).to receive(:model_for).with('albutts').and_return(Album)
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
          invite_only: false
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
