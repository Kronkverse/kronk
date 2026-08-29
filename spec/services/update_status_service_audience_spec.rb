# frozen_string_literal: true

require 'rails_helper'

# Per-post audience *editing* (docs/rebuild/per_post_audience.md): an edit can
# change a post's reach, krews, and add/remove people layer, and the change is
# reconciled into home feeds — narrowing pulls the post back from anyone who
# lost access, widening pushes it to the newly-included. It is routed through
# the normal edit flow, so the post is marked edited (transparent).
RSpec.describe UpdateStatusService do
  subject { described_class.new }

  let!(:alice)   { Fabricate(:user).account }
  let!(:mate)    { Fabricate(:user, account_attributes: { username: 'kept' }).account }
  let!(:removed) { Fabricate(:user, account_attributes: { username: 'removed' }).account }
  let!(:added)   { Fabricate(:user, account_attributes: { username: 'added' }).account }

  before do
    # alice is mutually mated with `mate` and `removed`; `added` is a stranger.
    [mate, removed].each do |a|
      alice.follow!(a)
      a.follow!(alice)
    end
  end

  def home_ids(account)
    HomeFeed.new(account).get(20).map(&:id)
  end

  # Post to Mates and let it fan out, so the reconciliation has real feeds to
  # act on.
  def mates_post!
    status = Fabricate(:status, account: alice, visibility: :mates)
    FanOutOnWriteService.new.call(status)
    status
  end

  it 'pulls the post from a mate the edit removes', :inline_jobs do
    status = mates_post!
    expect(status.id).to be_in(home_ids(removed))

    subject.call(status, alice.id, audience_exclude_ids: [removed.id])

    aggregate_failures do
      expect(status.id).to_not be_in(home_ids(removed)) # removed: pulled back
      expect(status.id).to be_in(home_ids(mate))        # untouched mate: kept
      expect(status.id).to be_in(home_ids(alice))       # author: always retains
    end
  end

  it 'pushes the post to a stranger the edit adds', :inline_jobs do
    status = mates_post!
    expect(status.id).to_not be_in(home_ids(added))

    subject.call(status, alice.id, audience_grant_ids: [added.id])

    expect(status.id).to be_in(home_ids(added))
  end

  it 'pulls the post from every mate when narrowed to self_only', :inline_jobs do
    status = mates_post!
    expect(status.id).to be_in(home_ids(mate))

    subject.call(status, alice.id, visibility: 'self_only')

    aggregate_failures do
      expect(status.reload.visibility).to eq('self_only')
      expect(status.id).to_not be_in(home_ids(mate))
      expect(status.id).to_not be_in(home_ids(removed))
    end
  end

  it 'marks the post edited when only the audience changes (transparency)', :inline_jobs do
    status = mates_post!

    expect { subject.call(status, alice.id, audience_exclude_ids: [removed.id]) }
      .to change { status.reload.edits.count }.by_at_least(1)

    expect(status.edited_at).to be_present
  end

  it 'leaves the audience untouched on a text-only edit', :inline_jobs do
    status = mates_post!
    status.granted_accounts << added
    FanOutOnWriteService.new.call(status, update: true)

    subject.call(status, alice.id, text: 'edited body')

    aggregate_failures do
      expect(status.reload.granted_accounts).to include(added)
      expect(status.id).to be_in(home_ids(added))
    end
  end
end
