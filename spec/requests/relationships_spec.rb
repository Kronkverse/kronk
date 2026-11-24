# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Relationships' do
  describe 'GET /relationships' do
    let(:user) { Fabricate(:user) }

    before { sign_in user }

    it 'sends you to your Mates list, where the page went' do
      get relationships_path

      expect(response).to redirect_to("/@#{user.account.username}/mates")
    end
  end
end
