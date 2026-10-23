# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/art.md, On a profile: the profile's Art tile shows up to four
# of a piece's photos.
RSpec.describe REST::ArtPieceSummarySerializer do
  subject { serialized_record_json(piece, described_class) }

  let(:owner) { Fabricate(:account) }
  let(:piece) { ArtPiece.create!(owner: owner, title: 'Coastline at dusk', kind: :painting, visibility: :public) }

  before do
    6.times do |position|
      piece.photos.create!(media_attachment: Fabricate(:media_attachment, account: owner), position: position)
    end
  end

  it 'gives the first four photos, in order, and counts them all', :aggregate_failures do
    expect(subject['preview_urls'].size).to eq 4
    expect(subject['preview_urls'].first).to eq piece.photos.ordered.first.media_attachment.file.url(:small)
    expect(subject['photo_count']).to eq 6
  end
end
