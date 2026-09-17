# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Scheduler::UserCleanupScheduler do
  subject { described_class.new }

  let!(:old_unconfirmed_user) { Fabricate(:user) }
  let!(:confirmed_user)       { Fabricate(:user) }

  describe '#perform' do
    before do
      # Update already-existing users because initialization overrides `confirmation_sent_at`
      old_unconfirmed_user.update!(confirmed_at: nil, confirmation_sent_at: 10.days.ago)
      confirmed_user.update!(confirmed_at: 1.day.ago)
    end

    # Kronk — email confirmation is voluntary, so an unconfirmed account is a
    # real member. The scheduler must NEVER delete it (upstream deleted such
    # accounts after 7 days; that hard-deleted a live user on shadow).
    it 'preserves unconfirmed accounts and never deletes users' do
      subject.perform

      expect(User.exists?(old_unconfirmed_user.id)).to be true
      expect(Account.exists?(old_unconfirmed_user.account_id)).to be true
      expect(User.exists?(confirmed_user.id)).to be true
    end
  end
end
