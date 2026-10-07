# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sign-in page provider buttons' do
  context 'without a sign-in provider configured', unless: Rails.configuration.x.omniauth.oidc_enabled? do
    it 'shows only the email and password form' do
      get new_user_session_path

      expect(response).to have_http_status(200)
      expect(response.body).to_not include('alternative-login')
    end
  end

  context 'with OpenID Connect configured', if: Rails.configuration.x.omniauth.oidc_enabled? do
    it 'offers a POST button to the provider' do
      get new_user_session_path

      button = response.parsed_body.at_css(".alternative-login form[action='#{user_openid_connect_omniauth_authorize_path}'][method='post'] button")
      expect(button).to be_present
    end
  end
end
