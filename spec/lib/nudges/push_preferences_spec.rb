# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::PushPreferences do
  let(:user)    { Fabricate(:user) }
  let(:account) { user.account }

  describe '.skip_legacy_push?' do
    def notification(type)
      instance_double(Notification, type: type, target_status: nil, account_id: account.id)
    end

    it 'skips the old push for a Mate request, which its nudge pushes' do
      expect(described_class.skip_legacy_push?(account, notification(:follow_request))).to be true
    end

    it 'keeps it for a notification with no nudge, unless its row is off' do
      expect(described_class.skip_legacy_push?(account, notification(:poll))).to be false

      user.settings[described_class::SETTING] = ['poll']
      user.save!

      expect(described_class.skip_legacy_push?(account, notification(:poll))).to be true
    end
  end
end
