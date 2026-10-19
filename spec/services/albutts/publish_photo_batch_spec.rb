# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Albutts::PublishPhotoBatch do
  let(:owner) { Fabricate(:account) }
  let(:ash)   { Fabricate(:account, username: 'ash') }
  let(:album) { Album.create!(owner: owner, title: 'Mayhem 2026', visibility: :public, created_at: 2.days.ago) }

  def add_photo(by, at)
    media = Fabricate(:media_attachment, account: by)
    status = Albutts::PublishPhoto.new(album: album, contributor: by, media_attachment: media).call
    AlbumPhoto.create!(album: album, contributor: by, status: status, created_at: at)
  end

  describe '#call' do
    it 'posts one burst once it has gone quiet' do
      last = 1.hour.ago
      3.times { |i| add_photo(ash, last - (2 - i).minutes) }

      batch = described_class.new(album, ash).call

      expect(batch.photos.count).to eq 3
      expect(batch.status).to have_attributes(account: ash, source_korner: 'albutts', visibility: 'public', text: 'Added 3 photos to Mayhem 2026')
      expect(described_class.new(album, ash).call).to be_nil
    end

    it 'waits while the burst is still going' do
      add_photo(ash, 2.minutes.ago)

      expect(described_class.new(album, ash).call).to be_nil
      expect(AlbumPhotoBatch.count).to eq 0
    end

    it "leaves out the owner's photos added while making the album" do
      add_photo(owner, album.created_at + 2.minutes)

      expect(described_class.new(album, owner).call).to be_nil
    end
  end

  describe '.backlog_all!' do
    it 'posts each earlier burst, dated when it happened' do
      first = add_photo(ash, 3.hours.ago)
      second = add_photo(ash, 1.hour.ago)

      described_class.backlog_all!

      batches = AlbumPhotoBatch.order(:id).to_a
      expect(batches.size).to eq 2
      expect(batches.map { |b| b.status.created_at.to_i }).to eq [first.created_at.to_i, second.created_at.to_i]
      expect(batches.first.status.id).to be < batches.last.status.id

      described_class.backlog_all!
      expect(AlbumPhotoBatch.count).to eq 2
    end
  end

  it 'drops the post when its photos are all deleted' do
    photo = add_photo(ash, 1.hour.ago)
    batch = described_class.new(album, ash).call

    photo.reload.destroy!

    expect(AlbumPhotoBatch.exists?(batch.id)).to be false
  end

  it 'shows the burst on its post to someone who can see the album' do
    2.times { |i| add_photo(ash, 1.hour.ago + i.minutes) }
    batch = described_class.new(album, ash).call
    viewer = Fabricate(:user)

    json = REST::StatusSerializer.new(batch.status.reload, scope: viewer, scope_name: :current_user).as_json
    expect(json[:album_photo_batch]).to include(photos_count: 2, album: { id: album.id.to_s, title: 'Mayhem 2026' })
    expect(json[:album_photo_batch][:previews].size).to eq 2
  end
end
