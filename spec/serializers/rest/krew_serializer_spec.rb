# frozen_string_literal: true

require 'rails_helper'

RSpec.describe REST::KrewSerializer do
  subject { serialized_record_json(krew, described_class) }

  let(:krew) { Krew.create!(slug: 'covered', name: 'Covered', access: 'open') }

  it 'has no image url without a cover' do
    expect(subject['image_url']).to be_nil
  end

  # A Krew with a cover used to fail to serialize at all (full_asset_url was
  # undefined), which broke every Krew list it appeared in.
  it 'gives a full url for the cover' do
    krew.update!(image: Rails.root.join('spec', 'fixtures', 'files', '600x400.png').open)

    expect(subject['image_url']).to start_with('http').and include('krews/images')
  end
end
