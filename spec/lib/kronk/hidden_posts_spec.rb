# frozen_string_literal: true

require 'rails_helper'

# Hidden posts are hidden by default (docs/decisions.md, 2026-10-19). An album
# photo's, a Moment's or a Kuestion answer's post stands behind something
# else and is never a post of its own: not in a feed, not on a profile, not in
# a post count, not in search, not on a Hub badge.
#
# Each surface is checked with an ordinary post beside the hidden ones, so a
# surface that shows nothing at all can't pass by accident.
RSpec.describe 'Hidden posts' do # rubocop:disable RSpec/DescribeClass
  # Made before the posts: a badge counts only what was posted after the
  # viewer joined.
  let!(:viewer) { Fabricate(:account, created_at: 1.day.ago) }
  let(:author) { Fabricate(:account, discoverable: true) }
  let!(:ordinary) { Fabricate(:status, account: author, visibility: :public, text: 'ordinary') }
  let!(:hidden) do
    Status::KRONK_BACKING_POST_TYPES.map do |type|
      Fabricate(:status, account: author, visibility: :public, post_type: type, text: type)
    end
  end

  before { viewer.follow!(author) }

  it 'are left out of the public feed' do
    expect(PublicFeed.new(viewer).get(20)).to contain_exactly(ordinary)
  end

  it 'are left out of tag feeds' do
    tag = Fabricate(:tag, name: 'hiddentest')
    [ordinary, *hidden].each { |status| status.tags << tag }

    expect(TagFeed.new(tag, viewer).get(20)).to contain_exactly(ordinary)
  end

  it 'are left out of link feeds' do
    card = Fabricate(:preview_card)
    [ordinary, *hidden].each { |status| PreviewCardsStatus.create!(status: status, preview_card: card) }

    expect(LinkFeed.new(card, viewer).get(20)).to contain_exactly(ordinary)
  end

  it 'are left out of the profile list, for the author too' do
    [viewer, author].each do |reader|
      expect(AccountStatusesFilter.new(author, reader).results).to contain_exactly(ordinary)
    end
  end

  it 'are not counted as the author’s posts' do
    expect(author.reload.statuses_count).to eq(1)

    hidden.each(&:destroy!)

    expect(author.reload.statuses_count).to eq(1)
  end

  it 'are left out of search' do
    hits = [ordinary, *hidden].map { |status| { type: :statuses, id: status.id } }

    expect(Kronk::Search::PolicyFilter.filter(hits, viewer).statuses).to contain_exactly(ordinary)
  end

  it 'are not updates on a Hub badge' do
    [ordinary, *hidden].each { |status| status.update_column(:source_korner, 'albutts') }

    expect(Kronk::KornerSeen.unread_count(viewer, 'albutts')).to eq(1)
  end

  # A new feed must decide about hidden posts. Each listed here is checked
  # above, or reads its posts from a feed that is (Home and lists are
  # filtered when FeedManager writes and rebuilds them).
  it 'are handled by every feed class' do
    checked = %w(home_feed link_feed list_feed public_feed tag_feed)
    feeds = Rails.root.glob('app/models/*_feed.rb').map { |path| path.basename('.rb').to_s }

    expect(feeds).to match_array(checked), <<~MSG
      A feed class was added or removed. Make sure it leaves hidden posts out
      (start from PublicFeed#public_scope or Status.without_kronk_backing_posts),
      test it here, then update this list.
    MSG
  end
end
