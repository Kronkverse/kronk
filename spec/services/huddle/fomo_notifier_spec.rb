# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Huddle::FomoNotifier do
  let(:ana) { Fabricate(:user).account }
  let(:bob) { Fabricate(:user).account }

  def set_threshold(account, value)
    UserKornerSetting.create!(user_id: account.user.id, korner_slug: 'huddle', values: { 'fomo_threshold' => value })
  end

  def gatherings_for(account)
    Nudges::Event.addressed_to(account).where(source_korner_slug: 'huddle', verb: 'gathering')
  end

  it 'nudges everyone at the default of 1 when the first person arrives' do
    ana
    bob

    described_class.new(reached: 1..1).call

    expect(gatherings_for(ana).count).to eq 1
    expect(gatherings_for(bob).count).to eq 1
  end

  it 'nudges only those whose number was just reached' do
    set_threshold(ana, 3)
    set_threshold(bob, 5)

    described_class.new(reached: 2..4).call

    expect(gatherings_for(ana).count).to eq 1
    expect(gatherings_for(bob).count).to eq 0
  end

  it 'makes a nudge from no one, with Join opening the Huddle' do
    ana

    described_class.new(reached: 1..1).call

    event = gatherings_for(ana).sole
    expect(event.actor_account).to be_nil
    expect(event).to have_attributes(interaction: 'interactive', cta_route: '/hub/huddle')
  end

  it 'leaves out someone who turned the row off' do
    ana.user.settings[Nudges::MuteCatalogue::SETTING] = ['huddle.gathering']
    ana.user.save!

    described_class.new(reached: 1..1).call

    expect(gatherings_for(ana)).to be_empty
  end

  it 'leaves out someone tuned out of Huddle' do
    KornerTuneOut.create!(account: ana, korner_slug: 'huddle', tuned_out_at: Time.current)

    described_class.new(reached: 1..1).call

    expect(gatherings_for(ana)).to be_empty
  end

  it "replaces an earlier gathering's nudge rather than adding another" do
    ana

    described_class.new(reached: 1..1).call
    described_class.new(reached: 1..1).call

    expect(gatherings_for(ana).count).to eq 1
  end
end
