# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-11-01 "Four sections": /share and /join are pages
# of the app. /share with a share intent (another site's share button, the
# PWA share target) still opens Mastodon's share page.
RSpec.describe 'Section routes' do
  it 'serves Share and Join from the app' do
    expect(get('/share')).to route_to('home#index')
    expect(get('/join')).to route_to('home#index')
  end
end
