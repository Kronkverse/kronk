# frozen_string_literal: true

require 'rails_helper'

RSpec.describe HuddleSession do
  let(:host) { Fabricate(:account) }

  def build(**overrides)
    described_class.new(
      title: 'Weekly sync',
      session_url: 'https://huddle.kronk.info/rooms/42',
      host_account: host,
      **overrides
    )
  end

  describe 'validations' do
    it 'requires a title' do
      expect(build(title: nil)).to_not be_valid
    end

    it 'requires a session_url' do
      expect(build(session_url: nil)).to_not be_valid
    end

    it 'requires state to be one of the known states' do
      expect(build(state: 'invalid')).to_not be_valid
    end

    it 'accepts the default state' do
      expect(build).to be_valid
    end
  end

  describe 'lifecycle' do
    let(:session) { described_class.create!(build.attributes.merge(state: 'scheduled')) }

    it '#start! flips state to live and publishes huddle.started' do
      received = nil
      Kronk::KornerEvents.reset!
      Kronk::KornerEvents.subscribe('huddle.started') { |payload| received = payload }

      session.start!

      expect(session.reload.state).to eq('live')
      expect(received).to include(huddle_session_id: session.id)
    end

    it '#end! flips state to ended and publishes huddle.ended' do
      session.start!

      received = nil
      Kronk::KornerEvents.reset!
      Kronk::KornerEvents.subscribe('huddle.ended') { |payload| received = payload }

      session.end!

      expect(session.reload.state).to eq('ended')
      expect(session.reload.ended_at).to be_present
      expect(received).to include(huddle_session_id: session.id)
    end

    it '#start! is a no-op on an already-live session' do
      session.start!
      expect(session.start!).to be false
    end
  end
end
