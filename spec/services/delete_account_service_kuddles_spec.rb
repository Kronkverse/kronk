# frozen_string_literal: true

require 'rails_helper'

# A Kuddle isn't owned by anyone; live sets are (Tal, 2026-10-29;
# docs/decisions.md). Purging the account that made a Kuddle leaves the
# Kuddle and its recordings, with no maker.
RSpec.describe DeleteAccountService do
  let(:maker)   { Fabricate(:user).account }
  let(:user)    { Fabricate(:user) }
  let!(:kuddle) { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }

  before { Kronk::KornerRegistry.reload! }

  def recording_of(kind, id)
    CallRecording.build_for(Kronk::CallTarget.find!(kind, id), filename: 'call.mp4', size: 100).tap do |recording|
      recording.status = 'ready'
      recording.save!
    end
  end

  def purge(account)
    described_class.new.call(account, reserve_username: false, reserve_email: false)
  end

  it 'keeps the Kuddle and its recordings, with no maker', :aggregate_failures do
    recording = recording_of('kuddle', kuddle.id)

    purge(maker)

    expect(Account.exists?(maker.id)).to be(false)
    expect(kuddle.reload.host_account_id).to be_nil
    expect(kuddle.host_account).to be_nil
    expect(CallRecording.exists?(recording.id)).to be(true)
  end

  it 'still takes the maker’s live sets and their recordings', :aggregate_failures do
    live = Fabricate(:booth_live, account: maker, started_at: 1.hour.ago, ended_at: 1.minute.ago)
    recording = recording_of('booth_live', live.id)

    purge(maker)

    expect(BoothLive.exists?(live.id)).to be(false)
    expect(CallRecording.exists?(recording.id)).to be(false)
  end

  it 'still lists and serializes a Kuddle with no maker, looked after by anyone signed in', :aggregate_failures do
    purge(maker)

    expect(HuddleSession.rooms.not_retired).to include(kuddle)
    json = serialized_record_json(kuddle.reload, REST::HuddleRoomSerializer, options: { scope: user, scope_name: :current_user })
    expect(json).to include('id' => kuddle.id.to_s, 'name' => 'Ember', 'is_host' => true)
  end

  it 'lets anyone in a Kuddle with no maker moderate it' do
    purge(maker)

    expect(Kronk::CallTarget.find!('kuddle', kuddle.id).moderator?(user.account)).to be(true)
  end
end
