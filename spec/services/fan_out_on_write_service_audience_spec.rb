# frozen_string_literal: true

require 'rails_helper'

# Per-post audience "people layer" (docs/rebuild/per_post_audience.md), fan-out
# half: on a gated post, a removed account must NOT get the home-feed insert,
# and an added account MUST — independent of the reach tier. Complements the
# StatusPolicy read-gate specs (the home feed trusts fan-out, so this is the
# only thing standing between a removed mate and the post in their feed).
RSpec.describe FanOutOnWriteService do
  subject { described_class.new }

  let!(:alice)   { Fabricate(:user).account }
  let!(:mate)    { Fabricate(:user, account_attributes: { username: 'kept' }).account }
  let!(:removed) { Fabricate(:user, account_attributes: { username: 'removed' }).account }
  let!(:added)   { Fabricate(:user, account_attributes: { username: 'added' }).account }

  before do
    # alice is mutually mated with both `mate` and `removed`; `added` is a
    # stranger (no follow relationship at all).
    [mate, removed].each do |a|
      alice.follow!(a)
      a.follow!(alice)
    end
  end

  def home_ids(account)
    HomeFeed.new(account).get(20).map(&:id)
  end

  it 'skips a removed mate and includes an added stranger, on a mates post', :inline_jobs do
    status = Fabricate(:status, account: alice, visibility: :mates)
    status.excluded_accounts << removed
    status.granted_accounts << added

    subject.call(status)

    aggregate_failures do
      expect(status.id).to be_in(home_ids(mate))         # ordinary mate: kept
      expect(status.id).to_not be_in(home_ids(removed))  # removed: skipped
      expect(status.id).to be_in(home_ids(added))        # added stranger: delivered
    end
  end

  it 'delivers a self_only post to an added account (the "specific people" case)', :inline_jobs do
    status = Fabricate(:status, account: alice, visibility: :self_only)
    status.granted_accounts << added

    subject.call(status)

    expect(status.id).to be_in(home_ids(added))
  end
end
