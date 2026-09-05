# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AutoGrooveInviterWorker do
  describe '#perform' do
    it 'auto-mates the invitee and the inviter (mutual follow), bypassing lock in both directions' do
      inviter = Fabricate(:user, account: Fabricate(:account, username: 'inviter', locked: true))
      invite  = Fabricate(:invite, user: inviter)
      newbie  = Fabricate(:user, invite: invite, account: Fabricate(:account, username: 'newbie', locked: true))

      described_class.new.perform(newbie.id)

      expect(newbie.account.following?(inviter.account)).to be(true)
      expect(inviter.account.following?(newbie.account)).to be(true)
      expect(newbie.account.mate?(inviter.account)).to be(true)
    end

    # Tal 2026-09-05: invited user's profile showed no mates even
    # though the auto-mate flow should have run. Checks the observable
    # UI symptoms — the `mates` scope + the denormalised counter —
    # rather than just `mate?`, so a broken cache/counter path
    # surfaces here too.
    it "populates both accounts' mates scope and mates_count" do
      inviter = Fabricate(:user, account: Fabricate(:account, username: 'inviter'))
      invite  = Fabricate(:invite, user: inviter)
      newbie  = Fabricate(:user, invite: invite, account: Fabricate(:account, username: 'newbie'))

      described_class.new.perform(newbie.id)

      expect(newbie.account.mates.pluck(:id)).to contain_exactly(inviter.account.id)
      expect(inviter.account.mates.pluck(:id)).to contain_exactly(newbie.account.id)
      expect(newbie.account.reload.mates_count).to eq(1)
      expect(inviter.account.reload.mates_count).to eq(1)
    end

    # Regression: the earlier rescue swallowed exceptions and returned,
    # defeating Sidekiq's `retry: 3`. A transient FollowService error
    # meant one silent failure with no retry, so the mate never
    # established. Re-raising is what makes retry actually retry.
    it 're-raises Mastodon::NotPermittedError so Sidekiq retries' do
      inviter = Fabricate(:user, account: Fabricate(:account, username: 'inviter'))
      invite  = Fabricate(:invite, user: inviter)
      newbie  = Fabricate(:user, invite: invite, account: Fabricate(:account, username: 'newbie'))

      follow_service = instance_double(FollowService)
      allow(FollowService).to receive(:new).and_return(follow_service)
      allow(follow_service).to receive(:call).and_raise(Mastodon::NotPermittedError, 'blocked')

      expect { described_class.new.perform(newbie.id) }.to raise_error(Mastodon::NotPermittedError)
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
