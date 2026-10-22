# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::NamedLink do
  let(:owner) { Fabricate(:account) }

  def album(title)
    Album.create!(owner: owner, title: title, visibility: :public)
  end

  it 'names a record after its title, and counts up for the same title' do
    expect([album('Beach Day').slug, album('beach day!').slug, album('Beach Day').slug])
      .to eq %w(beach-day beach-day-2 beach-day-3)
  end

  it 'never takes a bare number, which would be read as an id' do
    expect(album('2026').slug).to eq '2026-1'
  end

  it 'keeps out of reserved words' do
    event = Event.create!(account: owner, title: 'New', start_time: 1.day.from_now)

    expect(event.slug).to eq 'new-1'
  end

  it 'falls back to the kind of thing when the title has no letters' do
    expect(album('!!!').slug).to eq 'album'
  end

  it 'follows a rename and keeps the old name working' do
    record = album('Beach Day')
    record.update!(title: 'Dune Walk')

    expect(record.slug).to eq 'dune-walk'
    expect(Album.by_link!('beach-day')).to eq record
    expect(Album.by_link!('dune-walk')).to eq record
    expect(Album.by_link!(record.id.to_s)).to eq record
  end

  it 'keeps the name when a rename makes the same one' do
    record = album('Beach Day')
    album('Beach Day').update!(title: 'BEACH DAY')

    expect(record.reload.slug).to eq 'beach-day'
    expect(Album.find_by(title: 'BEACH DAY').slug).to eq 'beach-day-2'
  end

  it 'does not hand an old name to someone else' do
    album('Beach Day').update!(title: 'Dune Walk')

    expect(album('Beach Day').slug).to eq 'beach-day-2'
  end

  it 'can go back to its own old name' do
    record = album('Beach Day')
    record.update!(title: 'Dune Walk')
    record.update!(title: 'Beach Day')

    expect(record.slug).to eq 'beach-day'
    expect(Album.by_link!('dune-walk')).to eq record
  end

  it 'counts each kind of thing on its own' do
    album('Picnic')

    expect(Event.create!(account: owner, title: 'Picnic', start_time: 1.day.from_now).slug).to eq 'picnic'
  end

  it 'raises not found for a name nothing has had' do
    expect { Album.by_link!('nope') }.to raise_error(ActiveRecord::RecordNotFound)
  end
end
