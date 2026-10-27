# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Scheduler::HuddleFomoScheduler do
  let(:worker) { described_class.new }
  let(:notifier) { instance_double(Huddle::FomoNotifier, call: nil) }
  let(:reached) { [] }

  before do
    redis.del(described_class::ANNOUNCED_KEY, described_class::EMPTY_SINCE_KEY)
    allow(Huddle::FomoNotifier).to receive(:new) do |**options|
      reached << options[:reached]
      notifier
    end
  end

  def poll(count)
    allow(Kronk::HuddleCount).to receive(:fetch).and_return(count)
    worker.perform
  end

  it 'announces each count once as the Huddle fills' do
    poll(1)
    poll(3)

    expect(reached).to eq [1..1, 2..3]
  end

  it 'does not fire again as people drop in and out' do
    poll(3)
    poll(2)
    poll(3)

    expect(reached).to eq [1..3]
  end

  it 'does nothing when Jitsi cannot say' do
    poll(nil)

    expect(reached).to be_empty
  end

  it 'counts a short gap as the same gathering' do
    poll(2)
    poll(0)
    travel(5.minutes) { poll(2) }

    expect(reached).to eq [1..2]
  end

  it 'starts a new gathering once the Huddle has been empty a while' do
    poll(2)
    poll(0)
    travel(11.minutes) do
      poll(0)
      poll(1)
    end

    expect(reached).to eq [1..2, 1..1]
  end

  context 'with a followed Kuddle' do
    let(:maker) { Fabricate(:user).account }
    let!(:kuddle) { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }
    let(:calls) { [] }

    before do
      redis.del(*described_class.kuddle_keys(kuddle.id))
      allow(Huddle::FomoNotifier).to receive(:new) do |**options|
        calls << [options[:kuddle]&.id, options[:reached]]
        notifier
      end
    end

    def poll_both(main:, kuddle_count:)
      allow(Kronk::HuddleCount).to receive(:fetch).with(no_args).and_return(main)
      allow(Kronk::HuddleCount).to receive(:fetch).with(kuddle.session_url).and_return(kuddle_count)
      worker.perform
    end

    it 'asks about the Kuddle by its room key and announces it apart from the Main Huddle' do
      poll_both(main: 0, kuddle_count: 2)
      poll_both(main: 1, kuddle_count: 2)

      expect(calls).to eq [[kuddle.id, 1..2], [nil, 1..1]]
    end

    it 'remembers how many are in it, for the nudge to say' do
      poll_both(main: 0, kuddle_count: 3)

      expect(Kronk::HuddleCount.last_seen_kuddles([kuddle.id])).to eq(kuddle.id => 3)
    end

    it 'sends one nudge per gathering, and a new one after it has been empty a while' do
      poll_both(main: 0, kuddle_count: 2)
      poll_both(main: 0, kuddle_count: 1)
      poll_both(main: 0, kuddle_count: 2)
      poll_both(main: 0, kuddle_count: 0)
      travel(11.minutes) do
        poll_both(main: 0, kuddle_count: 0)
        poll_both(main: 0, kuddle_count: 1)
      end

      expect(calls).to eq [[kuddle.id, 1..2], [kuddle.id, 1..1]]
    end

    it 'still watches the Kuddles when the Main Huddle count is unknown' do
      poll_both(main: nil, kuddle_count: 1)

      expect(calls).to eq [[kuddle.id, 1..1]]
    end

    it 'does not watch a Kuddle nobody follows' do
      Huddle::Follows.unfollow!(maker, kuddle)

      poll_both(main: 0, kuddle_count: 4)

      expect(Kronk::HuddleCount).to_not have_received(:fetch).with(kuddle.session_url)
    end

    it 'does not watch a retired Kuddle' do
      kuddle.retire!

      poll_both(main: 0, kuddle_count: 4)

      expect(Kronk::HuddleCount).to_not have_received(:fetch).with(kuddle.session_url)
    end

    it 'watches at most MAX_KUDDLES a run' do
      stub_const("#{described_class}::MAX_KUDDLES", 1)
      HuddleRoom::CreateService.new.call(account: maker, name: 'Coworking')
      allow(Kronk::HuddleCount).to receive(:fetch).and_return(0)

      worker.perform

      expect(Kronk::HuddleCount).to have_received(:fetch).twice # the Main Huddle and one Kuddle
    end
  end
end
