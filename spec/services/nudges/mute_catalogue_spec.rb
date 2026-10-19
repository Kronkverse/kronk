# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::MuteCatalogue do
  describe '.rows' do
    it 'has a plain-English label for every listen entry' do
      expect(described_class.listen_keys - described_class::ROWS.keys).to eq([])
    end

    it 'labels nothing that is never delivered' do
      expect(described_class::ROWS.keys - described_class.keys).to eq([])
    end

    it 'offers one row for a verb template' do
      keys = described_class.keys

      expect(keys).to include('kalendar.rsvpd_{status}')
      expect(keys.grep(/\Akalendar\.rsvpd/)).to eq(['kalendar.rsvpd_{status}'])
    end

    it 'offers no row for things Kronk no longer does' do
      expect(described_class.keys).to_not include('reblog', 'follow', 'favourite', 'mention', 'reply')
    end

    it 'puts People rows first' do
      korners = described_class.rows.pluck(:korner)

      expect(korners.take_while(&:nil?)).to_not be_empty
      expect(korners.drop_while(&:nil?)).to all(be_present)
    end
  end

  describe '.key_for' do
    it 'maps a delivered korner and verb to its row' do
      expect(described_class.key_for('kommons', 'backed')).to eq('kommons.backed')
      expect(described_class.key_for('kalendar', 'rsvpd_going')).to eq('kalendar.rsvpd_{status}')
      expect(described_class.key_for('nudges', 'mention')).to eq('feed.mentioned')
      expect(described_class.key_for('freethedream', 'invited')).to eq('freethedream.invited')
    end
  end

  describe '.notification_muted?' do
    let(:user)    { Fabricate(:user) }
    let(:account) { user.account }

    before do
      user.settings['nudges.muted_types'] = ['feed.frothed', 'kommons.proposal_challenged']
      user.save!
    end

    it 'matches a froth on a plain post to the post froth row' do
      favourite = Fabricate(:favourite, status: Fabricate(:status, account: account))
      notification = Fabricate.build(:notification, account: account, activity: favourite, type: :favourite)

      expect(described_class.notification_muted?(account, notification)).to be true
    end

    it 'matches a bare korner notice type' do
      expect(described_class.notification_muted?(account, 'proposal_challenged')).to be true
      expect(described_class.notification_muted?(account, 'task_assigned')).to be false
    end
  end
end
