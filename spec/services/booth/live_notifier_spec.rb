# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Live sets: telling people.
RSpec.describe Booth::LiveNotifier do
  let(:host)       { Fabricate(:user).account }
  let(:ana)        { Fabricate(:user).account }
  let(:bob)        { Fabricate(:user).account }
  let(:booth_live) { Fabricate(:booth_live, account: host, started_at: 1.minute.ago) }

  def live_nudges_for(account)
    Nudges::Event.addressed_to(account).where(source_korner_slug: 'booth', verb: 'went_live')
  end

  it 'nudges everyone tuned in to the Booth, but not the host', :aggregate_failures do
    ana
    bob

    described_class.new(booth_live).call

    expect(live_nudges_for(ana).count).to eq 1
    expect(live_nudges_for(bob).count).to eq 1
    expect(live_nudges_for(host)).to be_empty
  end

  it 'says who went live, with Listen in opening the room' do
    ana

    described_class.new(booth_live).call

    expect(live_nudges_for(ana).sole).to have_attributes(
      actor_account: host,
      interaction: 'interactive',
      source_type: 'BoothLive',
      source_id: booth_live.id,
      cta_route: "/hub/booth/live/#{booth_live.id}"
    )
  end

  it 'leaves out someone who turned the row off' do
    ana.user.settings[Nudges::MuteCatalogue::SETTING] = ['booth.went_live']
    ana.user.save!

    described_class.new(booth_live).call

    expect(live_nudges_for(ana)).to be_empty
  end

  it 'leaves out someone tuned out of the Booth' do
    KornerTuneOut.create!(account: ana, korner_slug: 'booth', tuned_out_at: Time.current)

    described_class.new(booth_live).call

    expect(live_nudges_for(ana)).to be_empty
  end

  it 'does nothing for a set that is not live' do
    ana
    scheduled = Fabricate(:booth_live, account: host)

    described_class.new(scheduled).call

    expect(live_nudges_for(ana)).to be_empty
  end

  it 'takes the nudges back when the set ends' do
    ana
    described_class.new(booth_live).call

    booth_live.finish!

    expect(live_nudges_for(ana)).to be_empty
  end
end
