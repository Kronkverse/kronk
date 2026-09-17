# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KornerAttachment do
  # Phase 1 ships the primitive without touching manifests, so the specs
  # stub Kronk::KornerRegistry to hand back synthetic manifests + AR
  # classes. This isolates the model's behaviour from whether any real
  # korner has opted in yet — that's Phase 2's job.

  let(:account) { Fabricate(:account) }
  # Two real AR classes stand in as opposite-slug primary records — we
  # only need "something with an id and an account". Event and Album are
  # both present and cheap to create.
  let(:source_record) do
    Event.create!(
      account: account,
      title: 'Src',
      start_time: 2.days.from_now,
      end_time: 2.days.from_now + 2.hours
    )
  end
  let(:target_record) { Album.create!(owner: account, title: 'Tgt', visibility: :public) }

  # Synthetic manifests: sourcekorner attaches[to: targetkorner, kind: spawn];
  # targetkorner accepts[from: sourcekorner, kind: spawn].
  before do
    src_manifest = instance_double(
      Kronk::KornerRegistry::Manifest,
      slug: 'sourcekorner',
      attaches: [{ 'to' => 'targetkorner', 'kind' => 'spawn' }],
      accepts: []
    )
    tgt_manifest = instance_double(
      Kronk::KornerRegistry::Manifest,
      slug: 'targetkorner',
      attaches: [],
      accepts: [{ 'from' => 'sourcekorner', 'kind' => 'spawn' }]
    )

    # Pass through to the real registry by default, THEN override the two
    # synthetic slugs below. Without the passthrough these are strict
    # argument matchers, so any other slug raises "received :find with
    # unexpected arguments" — and creating the real Event fixture fires
    # `Kronk::AttachmentSource#fire_kronk_spawn_attachments`, which looks
    # up its own korner ('kalendar'). That is what made every example in
    # this file fail.
    allow(Kronk::KornerRegistry).to receive(:find).and_call_original
    allow(Kronk::KornerRegistry).to receive(:model_for).and_call_original

    allow(Kronk::KornerRegistry).to receive(:find).with('sourcekorner').and_return(src_manifest)
    allow(Kronk::KornerRegistry).to receive(:find).with('targetkorner').and_return(tgt_manifest)
    allow(Kronk::KornerRegistry).to receive(:model_for).with('sourcekorner').and_return(Event)
    allow(Kronk::KornerRegistry).to receive(:model_for).with('targetkorner').and_return(Album)
  end

  def attachment_attrs(overrides = {})
    {
      source_slug: 'sourcekorner', source_id: source_record.id,
      target_slug: 'targetkorner', target_id: target_record.id,
      kind: 'spawn',
      created_by_account: account
    }.merge(overrides)
  end

  describe 'validations' do
    it 'is valid when both manifests agree and records exist' do
      expect(described_class.new(attachment_attrs)).to be_valid
    end

    it 'rejects a kind that is not one of KINDS' do
      attachment = described_class.new(attachment_attrs(kind: 'ephemeral'))
      expect(attachment).to_not be_valid
      expect(attachment.errors[:kind]).to be_present
    end

    it 'rejects an attachment neither manifest permits' do
      # kind='link' is not declared in either synthetic manifest.
      attachment = described_class.new(attachment_attrs(kind: 'link'))
      expect(attachment).to_not be_valid
      expect(attachment.errors[:base].join).to match(/manifests do not permit/)
    end

    it 'accepts a wildcard target on the source side' do
      allow(Kronk::KornerRegistry.find('sourcekorner')).to receive(:attaches)
        .and_return([{ 'to' => '*', 'kind' => 'spawn' }])
      expect(described_class.new(attachment_attrs)).to be_valid
    end

    it 'accepts a wildcard source on the target side' do
      allow(Kronk::KornerRegistry.find('targetkorner')).to receive(:accepts)
        .and_return([{ 'from' => '*', 'kind' => 'spawn' }])
      expect(described_class.new(attachment_attrs)).to be_valid
    end

    it 'rejects a source id that names no record' do
      attachment = described_class.new(attachment_attrs(source_id: 0))
      expect(attachment).to_not be_valid
      expect(attachment.errors[:source_id]).to be_present
    end

    it 'rejects a target id that names no record' do
      attachment = described_class.new(attachment_attrs(target_id: 0))
      expect(attachment).to_not be_valid
      expect(attachment.errors[:target_id]).to be_present
    end

    it 'rejects a duplicate (same source, target, kind)' do
      described_class.create!(attachment_attrs)
      dup = described_class.new(attachment_attrs)
      expect(dup).to_not be_valid
    end
  end

  describe '#source_record / #target_record' do
    it 'resolves via KornerRegistry.model_for' do
      attachment = described_class.create!(attachment_attrs)
      expect(attachment.source_record).to eq(source_record)
      expect(attachment.target_record).to eq(target_record)
    end
  end

  describe 'scopes' do
    it 'from_source and to_target find the same row' do
      row = described_class.create!(attachment_attrs)
      expect(described_class.from_source('sourcekorner', source_record.id)).to include(row)
      expect(described_class.to_target('targetkorner', target_record.id)).to include(row)
    end
  end
end
