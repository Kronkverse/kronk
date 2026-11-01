# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-11-01 "Four sections": /share is the app's Share
# page, unless it carries a share intent (another site's share button, the
# PWA share target), which still opens Mastodon's share page.
RSpec.describe 'Share route' do
  it 'serves the app for /share' do
    get '/share'

    expect(response).to have_http_status(200)
  end

  it 'keeps a share intent on the share page, which asks you to sign in' do
    get '/share', params: { text: 'hello' }

    expect(response).to redirect_to(new_user_session_path)
  end
end
