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
end
