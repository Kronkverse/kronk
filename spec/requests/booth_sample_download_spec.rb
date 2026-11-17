# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Samples: downloading follows the sample's terms.
RSpec.describe 'Booth sample download' do
  let(:user)  { Fabricate(:user) }
  let(:maker) { Fabricate(:account) }

  it 'needs a signed-in member' do
    get "/hub/booth/samples/#{Fabricate(:booth_sample, account: maker).id}/download"

    expect(response).to redirect_to('/auth/sign_in')
  end

  context 'when signed in' do
    before { sign_in user }

    it 'saves a free sample as its title', :aggregate_failures do
      sample = Fabricate(:booth_sample, account: maker, title: 'Dusty Break')

      get "/hub/booth/samples/#{sample.id}/download"

      expect(response).to have_http_status(200)
      expect(response.headers['Content-Disposition']).to include('attachment').and include('dusty-break.mp3')
    end

    it 'keeps an ask-first sample until its maker says yes', :aggregate_failures do
      sample = Fabricate(:booth_sample, account: maker, terms: 'ask')

      get "/hub/booth/samples/#{sample.id}/download"
      expect(response).to have_http_status(404)

      sample.requests.create!(account: user.account, state: 'yes')
      get "/hub/booth/samples/#{sample.id}/download"
      expect(response).to have_http_status(200)
    end

    it 'gives nothing to someone the maker blocked' do
      sample = Fabricate(:booth_sample, account: maker)
      maker.block!(user.account)

      get "/hub/booth/samples/#{sample.id}/download"

      expect(response).to have_http_status(404)
    end
  end
end
