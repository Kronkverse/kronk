# frozen_string_literal: true

require 'rails_helper'

RSpec.describe HuddleParticipant do
  let(:host) { Fabricate(:account) }
  let(:session) do
    HuddleSession.create!(
      host_account: host,
      title: 'weekly sync',
      session_url: 'https://meet.kronk.info/abc',
      state: 'scheduled'
    )
  end
  let(:participant_account) { Fabricate(:account) }

  describe 'validations' do
    it 'defaults joined_at to now when omitted' do
      row = described_class.create!(huddle_session: session, account: participant_account)
      expect(row.joined_at).to be_within(2.seconds).of(Time.current)
    end

    it 'requires a huddle_session' do
      row = described_class.new(huddle_session: nil, account: participant_account, joined_at: Time.current)
      expect(row).to_not be_valid
    end

    it 'requires an account' do
      row = described_class.new(huddle_session: session, account: nil, joined_at: Time.current)
      expect(row).to_not be_valid
    end

    it 'accepts a nil left_at (still present)' do
      row = described_class.create!(huddle_session: session, account: participant_account)
      expect(row.left_at).to be_nil
    end
  end

  describe 'scopes' do
    let!(:present_row) do
      described_class.create!(
        huddle_session: session,
        account: participant_account
      )
    end
    let!(:left_row) do
      described_class.create!(
        huddle_session: session,
        account: Fabricate(:account),
        joined_at: 10.minutes.ago,
        left_at: 2.minutes.ago
      )
    end

    it 'currently_present returns only rows with a nil left_at' do
      expect(described_class.currently_present).to include(present_row)
      expect(described_class.currently_present).to_not include(left_row)
    end
  end
end
