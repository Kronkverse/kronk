# frozen_string_literal: true

require 'rails_helper'

# Korner records that hold a MediaAttachment directly — a Moment's media, a
# Booth set's audio and cover — rather than through a Status. Their foreign
# keys refuse a delete that would strand them, so account deletion has to
# clear them before it purges the account's media.
#
# Regression coverage for two things found on 2026-09-04:
#
#   * deleting an account that had ever posted a Moment raised
#     `ActiveRecord::InvalidForeignKey` partway through, so the account could
#     not be deleted at all;
#   * Booth avoided that only because its keys were `ON DELETE SET NULL`,
#     which quietly emptied sets instead. Those keys are now `RESTRICT`
#     (`RestrictBoothMediaDeletes`), which would have broken deletion the same
#     way without the purge step.
RSpec.describe DeleteAccountService do
  subject { described_class.new }

  describe 'an account holding korner-owned media' do
    let(:account) { Fabricate(:account) }
    let(:media)   { Fabricate(:media_attachment, account: account) }

    context 'with a Moment' do
      before { Moment.create!(account: account, media_attachment: media, visibility: :public) }

      it 'deletes the account without a foreign key violation', :aggregate_failures do
        expect { subject.call(account, reserve_username: false) }.to_not raise_error

        expect(Account.find_by(id: account.id)).to be_nil
        expect(MediaAttachment.find_by(id: media.id)).to be_nil
      end
    end

    context 'with a Booth set' do
      before do
        BoothSet.create!(
          account: account, title: 'Ripple', artist_name: 'BludPlum',
          audio_attachment_id: media.id, published: true
        )
      end

      it 'deletes the account without a foreign key violation', :aggregate_failures do
        expect { subject.call(account, reserve_username: false) }.to_not raise_error

        expect(Account.find_by(id: account.id)).to be_nil
        expect(BoothSet.where(account_id: account.id)).to_not exist
        expect(MediaAttachment.find_by(id: media.id)).to be_nil
      end
    end
  end

  describe 'deleting media a Booth set still points at' do
    let(:account) { Fabricate(:account) }
    let(:media)   { Fabricate(:media_attachment, account: account) }
    let!(:booth_set) do
      BoothSet.create!(
        account: account, title: 'Ripple', artist_name: 'BludPlum',
        audio_attachment_id: media.id, published: true
      )
    end

    # The point of the whole change: a stray delete must raise rather than
    # blank the pointer and leave a set with no music.
    it 'is refused rather than silently blanking the set', :aggregate_failures do
      expect { media.destroy }.to raise_error(ActiveRecord::InvalidForeignKey)

      expect(booth_set.reload.audio_attachment_id).to eq(media.id)
    end
  end
end
