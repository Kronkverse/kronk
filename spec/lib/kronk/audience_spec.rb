# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Audience do
  let(:owner)   { Fabricate(:account) }
  let(:growers) { Krew.create!(slug: 'growers', name: 'Growers', access: 'open') }
  let(:album)   { Album.create!(owner: owner, title: 'Harvest photos', visibility: :public) }
  let(:film)    { Film.create!(owner: owner, title: 'Harvest film', visibility: :mates) }
  let(:story)   { Chronicle.create!(owner: owner, title: 'Harvest story', body: 'It rained.', visibility: :mates) }

  before do
    Kronk::KornerRegistry.reload!
    growers.krew_memberships.create!(account: owner)
  end

  def link(source, target)
    KornerAttachment.create!(source_slug: described_class.slug_of(source), source_id: source.id,
                             target_slug: described_class.slug_of(target), target_id: target.id,
                             kind: 'link', created_by_account: owner)
  end

  def follow(follower, leader)
    described_class.follow!(link(follower, leader), 'source')
  end

  describe '.followable?' do
    it 'takes Everyone, and Krews alone, but not Mates, Orbit or Just me' do
      expect(described_class.followable?(album)).to be(true)
      album.update!(visibility: :self_only)
      expect(described_class.followable?(album)).to be(false)
      album.album_krews.create!(krew: growers)
      expect(described_class.followable?(album.reload)).to be(true)
      expect(described_class.followable?(film)).to be(false)
      film.update!(visibility: :orbit)
      expect(described_class.followable?(film)).to be(false)
    end
  end

  it 'passes a change down a chain of followers' do
    follow(film, album)
    follow(story, film)
    expect([film.reload.visibility, story.reload.visibility]).to eq(%w(public public))

    album.update!(visibility: :self_only)

    expect([film.reload.visibility, story.reload.visibility]).to eq(%w(self_only self_only))
  end

  it 'refuses a follow that would close a circle' do
    follow(film, album)

    expect(described_class.follow_error(album, film.reload)).to include('circle')
  end

  it 'stops at a circle written straight into the table' do
    follow(film, album)
    link(album, film).update!(metadata: { 'audience_follows' => 'target' })
    album.update_column(:visibility, :mates)

    expect { described_class.propagate(album) }.to_not raise_error
    expect([film.reload.visibility, album.reload.visibility]).to eq(%w(self_only self_only))
  end

  it 'reads many records with the same number of queries as a few' do
    event = Event.create!(account: owner, title: 'Harvest', start_time: 1.day.from_now)
    album.album_krews.create!(krew: growers)
    few = [album, film, event]
    many = few + Array.new(3) { |i| Album.create!(owner: owner, title: "Album #{i}", visibility: :public).tap { |a| a.album_krews.create!(krew: growers) } } +
           Array.new(3) { |i| Film.create!(owner: owner, title: "Film #{i}", visibility: :public) } +
           Array.new(3) { |i| Event.create!(account: owner, title: "Event #{i}", start_time: 1.day.from_now) }

    expect(query_count { described_class.summaries(many, owner) }).to eq(query_count { described_class.summaries(few, owner) })
  end

  def query_count(&)
    count = 0
    counter = ->(*, payload) { count += 1 unless payload[:name].in?(%w(SCHEMA TRANSACTION)) || payload[:cached] }
    ActiveSupport::Notifications.subscribed(counter, 'sql.active_record', &)
    count
  end
end
