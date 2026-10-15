# frozen_string_literal: true

require 'rails_helper'

# A post shared to a Krew lands in its members' home feeds (docs/spaces/krew.md).
# This raised on every Krew post until October 2026 and nothing noticed,
# because no spec sent a Krew post through the fan-out.
RSpec.describe FanOutOnWriteService do
  let(:last_active_at) { Time.now.utc }
  let!(:author)   { Fabricate(:user, current_sign_in_at: last_active_at).account }
  let!(:member)   { Fabricate(:user, current_sign_in_at: last_active_at).account }
  let!(:other)    { Fabricate(:user, current_sign_in_at: last_active_at).account }
  let!(:stranger) { Fabricate(:user, current_sign_in_at: last_active_at).account }

  let(:krew)  { Krew.create!(slug: 'growers', name: 'Growers', access: 'open') }
  let(:krew2) { Krew.create!(slug: 'cooks', name: 'Cooks', access: 'open') }

  def home_feed_of(account)
    HomeFeed.new(account).get(10).map(&:id)
  end

  before do
    [author, member].each { |account| krew.krew_memberships.create!(account: account) }
    [author, member, other].each { |account| krew2.krew_memberships.create!(account: account) }
    allow(redis).to receive(:publish)
  end

  it 'delivers to every member of every targeted Krew, once each', :inline_jobs do
    status = Fabricate(:status, account: author, visibility: :self_only)
    status.krews << krew
    status.krews << krew2

    expect { described_class.new.call(status) }.to_not raise_error

    expect(status.id).to be_in(home_feed_of(member)).and be_in(home_feed_of(other))
    expect(status.id).to_not be_in(home_feed_of(stranger))
  end
end
