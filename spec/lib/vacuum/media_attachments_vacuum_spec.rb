# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Vacuum::MediaAttachmentsVacuum do
  subject { described_class.new(retention_period) }

  let(:retention_period) { 7.days }
  let(:remote_status) { Fabricate(:status, account: Fabricate(:account, domain: 'example.com')) }
  let(:local_status) { Fabricate(:status) }

  describe '#perform' do
    let!(:old_remote_media) { Fabricate(:media_attachment, remote_url: 'https://example.com/foo.png', status: remote_status, created_at: (retention_period + 1.day).ago, updated_at: (retention_period + 1.day).ago) }
    let!(:old_local_media) { Fabricate(:media_attachment, status: local_status, created_at: (retention_period + 1.day).ago, updated_at: (retention_period + 1.day).ago) }
    let!(:new_remote_media) { Fabricate(:media_attachment, remote_url: 'https://example.com/foo.png', status: remote_status) }
    let!(:new_local_media) { Fabricate(:media_attachment, status: local_status) }
    let!(:old_unattached_media) { Fabricate(:media_attachment, account_id: nil, created_at: 10.days.ago) }
    let!(:new_unattached_media) { Fabricate(:media_attachment, account_id: nil, created_at: 1.hour.ago) }

    it 'handles attachments based on metadata details' do
      subject.perform

      expect(old_remote_media.reload.file) # Remote and past retention period
        .to be_blank
      expect(old_local_media.reload.file) # Local and past retention
        .to_not be_blank
      expect(new_remote_media.reload.file) # Remote and within retention
        .to_not be_blank
      expect(new_local_media.reload.file) # Local and within retention
        .to_not be_blank
      expect { old_unattached_media.reload } # Unattached and past TTL
        .to raise_error(ActiveRecord::RecordNotFound)
      expect(new_unattached_media.reload) # Unattached and within TTL
        .to be_persisted
    end

    context 'with a photo of a Wachuneed listing' do
      let!(:listing_photo) { Fabricate(:media_attachment, status: nil, created_at: 10.days.ago) }

      before do
        listing = Listing.create!(account: listing_photo.account, title: 'Bike', category: 'goods', state: 'live')
        ListingPhoto.create!(listing: listing, media_attachment: listing_photo, position: 0)
      end

      it 'keeps it, though it belongs to no post' do
        subject.perform

        expect(listing_photo.reload).to be_persisted
      end
    end

    context 'with attachments referenced by a BoothSet' do
      around do |example|
        Sidekiq::Testing.inline! { example.run }
      end

      let!(:booth_audio) { Fabricate(:media_attachment, account_id: nil, created_at: 1.day.ago - 1.hour) }
      let!(:booth_cover) { Fabricate(:media_attachment, account_id: nil, created_at: 1.day.ago - 1.hour) }

      before do
        Fabricate(:booth_set, audio_attachment: booth_audio, cover_attachment: booth_cover)
      end

      it 'does not delete booth audio or cover even though they look unattached' do
        subject.perform

        expect(booth_audio.reload).to be_persisted
        expect(booth_cover.reload).to be_persisted
      end
    end

    context 'with uploads kept by korners rather than posts' do
      let(:owner) { Fabricate(:account) }
      let!(:kar_photo)     { old_upload }
      let!(:event_image)   { old_upload }
      let!(:message_photo) { old_upload }
      let!(:draft_photo)   { old_upload }
      let!(:album_draft_photo) { old_upload }
      let!(:orphan)        { old_upload }
      let!(:tagged_orphan) { old_upload }

      def old_upload
        Fabricate(:media_attachment, account: owner, status: nil, created_at: 2.days.ago)
      end

      before do
        kar = Kar.create!(owner: owner, title: 'Ute', make: 'Holden', model: 'Kingswood', year: 1976)
        KarPhoto.create!(kar: kar, media_attachment: kar_photo, position: 0)
        Event.create!(account: owner, title: 'Picnic', start_time: 1.day.from_now, image: event_image)
        Draft.create!(account: owner, media_attachment_ids: [draft_photo.id])
        AlbumDraft.create!(account: owner, media_attachment_ids: [album_draft_photo.id])
        conversation = Nudges::Conversation.mate_between!(owner, Fabricate(:account))
        conversation.messages.create!(author_account_id: owner.id, media_attachment_ids: [message_photo.id])
        MediaTag.create!(media_attachment: tagged_orphan, account: Fabricate(:account), created_by_account: owner, x: 0.5, y: 0.5)
      end

      it 'keeps what a korner points at and deletes true orphans, tagged or not' do
        subject.perform

        expect([kar_photo, event_image, message_photo, draft_photo, album_draft_photo].map { |m| MediaAttachment.exists?(m.id) }).to all(be(true))
        expect(MediaAttachment.exists?(orphan.id)).to be(false)
        expect(MediaAttachment.exists?(tagged_orphan.id)).to be(false)
      end
    end

    # Every column that holds an upload id must protect it, or a new korner
    # quietly loses its media a day after upload.
    it 'lists every column in the schema that holds an upload id' do
      connection = ActiveRecord::Base.connection
      ignored = %w(statuses status_edits media_tags media_attachments).freeze
      holders = connection.tables.reject { |t| ignored.include?(t) }.flat_map do |table|
        by_key = connection.foreign_keys(table).select { |fk| fk.to_table == 'media_attachments' }.map(&:column)
        by_name = connection.columns(table).map(&:name).grep(/(media_attachment_ids?|attachment_id)\z/)
        (by_key + by_name).uniq.map { |column| "#{table}.#{column}" }
      end
      listed = described_class::KEEPERS.flat_map { |table, columns| columns.map { |column| "#{table}.#{column}" } }

      expect(holders - listed).to be_empty
    end
  end
end
