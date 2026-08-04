# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AutoGrooveInviterWorker do
  describe '#perform' do
    it 'grooves (follows) the inviter, bypassing their follower-approval lock' do
      inviter = Fabricate(:user, account: Fabricate(:account, username: 'inviter', locked: true))
      invite  = Fabricate(:invite, user: inviter)
      newbie  = Fabricate(:user, invite: invite, account: Fabricate(:account, username: 'newbie'))

      described_class.new.perform(newbie.id)

      expect(newbie.account.following?(inviter.account)).to be(true)
    end

    it 'is a no-op for a user that was not invited' do
      newbie = Fabricate(:user, account: Fabricate(:account, username: 'solo'))

      expect { described_class.new.perform(newbie.id) }.to_not raise_error
      expect(newbie.account.active_relationships.count).to eq(0)
    end

    it 'is a no-op for a missing user' do
      expect { described_class.new.perform(-1) }.to_not raise_error
    end
  end
end
