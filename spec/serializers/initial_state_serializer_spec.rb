# frozen_string_literal: true

require 'rails_helper'

RSpec.describe InitialStateSerializer do
  subject { serialized_record_json(state, described_class) }

  describe 'meta korner_icons' do
    let(:state) { InitialStatePresenter.new(settings: {}, token: nil, current_account: nil, admin: nil, owner: nil, text: nil) }

    it 'carries each space icon name so the nav draws on the first frame' do
      icons = subject['meta']['korner_icons']
      expected = Kronk::KornerRegistry.all.find { |m| m.icon&.dig('material') }

      expect(icons).to include(expected.slug => expected.icon['material'])
    end
  end
end
