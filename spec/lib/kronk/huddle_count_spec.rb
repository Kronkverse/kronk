# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::HuddleCount do
  let(:domain) { Rails.configuration.x.kronk_jitsi_domain }

  describe '.fetch' do
    it 'asks for the Main Huddle by its Jitsi name, prefix and all' do
      allow(Kronk::Jitsi).to receive(:room_prefix).and_return('shadow-')
      stub_request(:get, "https://#{domain}/room-size?room=shadow-huddle&domain=meet.jitsi")
        .to_return(status: 200, body: '{"participants":3}')

      expect(described_class.fetch).to eq 3
    end

    it 'reads a 404 as nobody there' do
      stub_request(:get, "https://#{domain}/room-size?room=ember-1a2b&domain=meet.jitsi").to_return(status: 404)

      expect(described_class.fetch('ember-1a2b')).to eq 0
    end
  end
end
