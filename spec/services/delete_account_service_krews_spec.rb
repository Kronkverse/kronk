# frozen_string_literal: true

require 'rails_helper'

# A deleted account leaves its Krews the way anyone leaves one: the count
# drops, and a Krew left with nobody in it archives. Both deletion paths are
# covered, the one that keeps the account record to reserve the username and
# the one that destroys it.
RSpec.describe DeleteAccountService do
  subject { described_class.new }

  let(:account) { Fabricate(:account) }
  let(:other)   { Fabricate(:account) }
  let(:shared)  { Krew.create!(slug: 'shared', name: 'Shared', access: 'open') }
  let(:solo)    { Krew.create!(slug: 'solo', name: 'Solo', access: 'open') }

  before do
    shared.krew_memberships.create!(account: account, role: 'member', source: 'direct')
    shared.krew_memberships.create!(account: other, role: 'member', source: 'direct')
    solo.krew_memberships.create!(account: account, role: 'member', source: 'direct')
  end

  [true, false].each do |reserve|
    context "with reserve_username: #{reserve}" do
      before { subject.call(account, reserve_username: reserve) }

      it 'leaves a Krew others are still in, which stays open', :aggregate_failures do
        shared.reload
        expect(shared.member_count).to eq 1
        expect(shared.member?(account)).to be false
        expect(shared).to_not be_archived
      end

      it 'archives a Krew it was the only member of', :aggregate_failures do
        solo.reload
        expect(solo.member_count).to eq 0
        expect(solo).to be_archived
      end
    end
  end

  it 'drops its waiting join requests' do
    gated = Krew.create!(slug: 'gated', name: 'Gated', access: 'approval')
    KrewJoinRequest.create!(krew: gated, account: account)

    subject.call(account)

    expect(KrewJoinRequest.where(account_id: account.id)).to be_empty
  end
end
