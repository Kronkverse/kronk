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

  context 'with a Kuddle' do
    let(:maker) { Fabricate(:user).account }
    let(:kuddle) { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }
    let(:outsider) { Fabricate(:user).account }

    def kuddle_gatherings_for(account)
      Nudges::Event.addressed_to(account).where(source_korner_slug: 'huddle', verb: 'kuddle_gathering')
    end

    before do
      outsider
      Huddle::Follows.follow!(ana, kuddle)
    end

    it 'nudges its followers once, about that Kuddle, with Join opening it' do
      described_class.new(reached: 1..1, kuddle: kuddle).call

      event = kuddle_gatherings_for(ana).sole
      expect(event).to have_attributes(actor_account: nil, source_type: 'HuddleSession', source_id: kuddle.id,
                                       interaction: 'interactive', cta_route: "/hub/huddle/kuddle/#{kuddle.id}")
      expect(kuddle_gatherings_for(maker).count).to eq 1
    end

    it 'leaves out people who do not follow it' do
      described_class.new(reached: 1..1, kuddle: kuddle).call

      expect(kuddle_gatherings_for(outsider)).to be_empty
      expect(gatherings_for(outsider)).to be_empty
    end

    it 'leaves out someone who unfollowed it' do
      Huddle::Follows.unfollow!(ana, kuddle)

      described_class.new(reached: 1..1, kuddle: kuddle).call

      expect(kuddle_gatherings_for(ana)).to be_empty
    end

    it 'nudges the members of a Krew it is Konnected to' do
      krew = Krew.create!(slug: 'embers', name: 'Embers', access: 'open')
      krew.krew_memberships.create!(account: maker)
      krew.krew_memberships.create!(account: outsider)
      Kronk::AttachmentEffects.link!('huddle', kuddle.id, 'krew', krew.id, maker)

      described_class.new(reached: 1..1, kuddle: kuddle).call

      expect(kuddle_gatherings_for(outsider).count).to eq 1
    end

    it 'uses the same number as the Main Huddle' do
      set_threshold(ana, 3)

      described_class.new(reached: 1..2, kuddle: kuddle).call
      expect(kuddle_gatherings_for(ana)).to be_empty

      described_class.new(reached: 3..3, kuddle: kuddle).call
      expect(kuddle_gatherings_for(ana).count).to eq 1
    end

    it 'leaves out someone who turned its row off, even with the Main row on' do
      ana.user.settings[Nudges::MuteCatalogue::SETTING] = ['huddle.kuddle_gathering']
      ana.user.save!

      described_class.new(reached: 1..1, kuddle: kuddle).call

      expect(kuddle_gatherings_for(ana)).to be_empty
    end

    it 'leaves out someone tuned out of Huddle' do
      KornerTuneOut.create!(account: ana, korner_slug: 'huddle', tuned_out_at: Time.current)

      described_class.new(reached: 1..1, kuddle: kuddle).call

      expect(kuddle_gatherings_for(ana)).to be_empty
    end

    it "replaces that Kuddle's earlier nudge, and leaves another Kuddle's and the Main Huddle's" do
      other = HuddleRoom::CreateService.new.call(account: maker, name: 'Coworking')
      Huddle::Follows.follow!(ana, other)
      described_class.new(reached: 1..1).call
      described_class.new(reached: 1..1, kuddle: other).call

      2.times { described_class.new(reached: 1..1, kuddle: kuddle).call }

      expect(kuddle_gatherings_for(ana).pluck(:source_id)).to contain_exactly(kuddle.id, other.id)
      expect(gatherings_for(ana).count).to eq 1
    end
  end
end
