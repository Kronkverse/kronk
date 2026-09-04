# frozen_string_literal: true

require 'rails_helper'

# The shelved profile answers to one canonical URL, `/@:acct`. Three older
# spellings still exist because links to them were minted along the way, and
# the client redirects each to the canonical one.
#
# A client-side redirect only helps once the SPA is running, so each of these
# needs a Rails-side mount serving the app shell. `/shelves` had none until
# 2026-09-05: a direct hit — bookmark, pasted link, hard reload — was a Rails
# 404 and the redirect never ran. Same failure `/welcome` had, so this pins all
# three rather than only the one that broke.
RSpec.describe 'Profile URL aliases' do
  let(:account) { Fabricate(:account, username: 'alice') }

  %w(profile shelves edit).each do |alias_path|
    it "serves the app shell at /@:acct/#{alias_path} so the client can redirect" do
      get "/@#{account.username}/#{alias_path}"

      expect(response).to have_http_status(200)
    end
  end

  it 'serves the canonical profile' do
    get "/@#{account.username}"

    expect(response).to have_http_status(200)
  end
end
