# frozen_string_literal: true

require 'rails_helper'

# Kronk rows that point at an account (or at its notifications) used to have
# no ON DELETE rule, so deleting the account stopped partway. See
# db/migrate/20261015120000_let_deletes_through_korner_foreign_keys.rb.
RSpec.describe DeleteAccountService do
  let!(:member) { Fabricate(:user).account }
  let!(:friend) { Fabricate(:user).account }

  it 'deletes an account that exchanged nudge messages, commented, frothed and tagged' do
    NudgeService.new.call(member, friend, text: 'hello')
    NudgeService.new.call(friend, member, text: 'hi back')

    Fabricate(:proposal_comment, proposal: Fabricate(:proposal, created_by_account: friend), account: member)

    moment = Moment.create!(account: friend, media_attachment: Fabricate(:media_attachment, account: friend), visibility: :public)
    moment.moment_froths.create!(account: member)

    MediaTag.create!(media_attachment: Fabricate(:media_attachment, account: friend), account: member, created_by_account: friend, x: 0.5, y: 0.5)

    expect { described_class.new.call(member, reserve_username: false, reserve_email: false) }.to_not raise_error

    expect(Account.exists?(member.id)).to be(false)
    expect(NudgeMessage.joins(:notification).where(notifications: { account_id: member.id })).to_not exist
  end

  it 'frees the handle only of a signup still waiting for approval' do
    unconfirmed_member = Fabricate(:user, confirmed_at: nil, approved: true).account

    described_class.new.call(unconfirmed_member)

    expect(Account.exists?(unconfirmed_member.id)).to be(true)
  end
end
