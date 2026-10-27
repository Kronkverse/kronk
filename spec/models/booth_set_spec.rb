# frozen_string_literal: true

require 'rails_helper'

# Albums and EPs (docs/spaces/booth.md, Albums): several tracks, each its own
# audio file, in place of a set's one recording.
RSpec.describe BoothSet do
  let(:account) { Fabricate(:account) }

  def album(kind: 'album', tracks: 2, durations: nil)
    set = described_class.new(account: account, title: 'Tides', artist_name: 'Ash', kind: kind)
    tracks.times do |i|
      set.tracks.build(
        audio_attachment: Fabricate(:media_attachment, account: account),
        title: "Track #{i + 1}", position: i, duration_seconds: durations&.at(i)
      )
    end
    set
  end

  describe 'an album or EP' do
    it 'is valid with two tracks or more', :aggregate_failures do
      expect(album(tracks: 2)).to be_valid
      expect(album(kind: 'ep', tracks: 4)).to be_valid
    end

    it 'needs at least two tracks', :aggregate_failures do
      set = album(tracks: 1)

      expect(set).to_not be_valid
      expect(set.errors.full_messages).to include('An album or EP needs at least 2 tracks')
    end

    it 'has at most the maximum number of tracks' do
      expect(album(tracks: described_class::ALBUM_TRACKS_MAX + 1)).to_not be_valid
    end

    it 'has no single audio file of its own' do
      set = album
      set.audio_attachment = Fabricate(:media_attachment, account: account)

      expect(set).to_not be_valid
    end

    it 'does not count a track that is about to be removed' do
      set = album(tracks: 2)
      set.save!
      set.tracks.first.mark_for_destruction

      expect(set).to_not be_valid
    end

    it 'keeps its tracks in running order', :aggregate_failures do
      set = album(tracks: 3)
      set.save!
      set.tracks.find_by(position: 0).update!(position: 5)

      expect(set.reload.tracks.map(&:title)).to eq ['Track 2', 'Track 3', 'Track 1']
      expect(set.audio_url).to eq set.tracks.first.audio_url
    end

    it 'is as long as its tracks when every length is known', :aggregate_failures do
      known = album(tracks: 2, durations: [120, 200])
      known.validate
      expect(known.duration_seconds).to eq 320

      partly = album(tracks: 2, durations: [120, nil])
      partly.validate
      expect(partly.duration_seconds).to be_nil
    end
  end

  describe 'any other kind' do
    it 'stays one recording with no tracks', :aggregate_failures do
      expect(described_class.new(account: account, title: 'Warm-up', artist_name: 'Ash')).to be_valid

      mix = album(kind: 'mix')
      expect(mix).to_not be_valid
      expect(mix.errors.full_messages).to include('Only an album or EP has tracks of its own')
    end
  end

  describe 'deleting a set' do
    it 'takes its tracks with it but not their audio', :aggregate_failures do
      set = album
      set.save!
      audio_ids = set.tracks.map(&:audio_attachment_id)

      set.destroy!

      expect(BoothSetTrack.where(booth_set_id: set.id)).to_not exist
      expect(MediaAttachment.where(id: audio_ids).count).to eq 2
    end
  end
end
