# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Welcome' do
  describe 'GET /welcome' do
    it 'goes to the feed, now the welcome page is gone' do
      get '/welcome'

      expect(response).to redirect_to('/home')
    end
  end

  # Approval emails sent before 2026-10-05 link to /welcome.html, the old
  # name of the account-approved page. It must reach that page, not be
  # swallowed by /welcome as format=html.
  describe 'GET /welcome.html' do
    it 'redirects to the account-approved page' do
      get '/welcome.html'

      expect(response).to redirect_to('/approved.html')
    end
  end
end
