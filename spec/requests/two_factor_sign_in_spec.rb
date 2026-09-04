# frozen_string_literal: true

require 'rails_helper'

# Sign-in through the real middleware stack, which is the level this needed:
# the controller specs only asserted "did it redirect", and the bug was that
# the person WAS signed in while being shown a failure page. Checking the
# redirect and the resulting session together is what pins it.
#
# Kronk 2FA is TOTP (an authenticator app) or a WebAuthn security key, with
# ten single-use recovery codes. There is no email or SMS code path.
RSpec.describe 'Two-factor sign-in' do
  let(:password) { 'abcdefghij' }

  # `/home` is no good as a probe — it answers 200 to anonymous visitors too
  # (signed out, it renders the landing). `/settings/profile` actually requires
  # a session and bounces to sign-in without one.
  def signed_in?
    get '/settings/profile'
    response.status == 200
  end

  context 'without two-factor enabled' do
    let!(:user) { Fabricate(:user, email: 'plain@example.com', password: password) }

    it 'signs in and redirects', :aggregate_failures do
      post '/auth/sign_in', params: { user: { email: user.email, password: password } }

      expect(response).to have_http_status(302)
      expect(signed_in?).to be true
    end
  end

  context 'with an authenticator app' do
    let!(:user) do
      Fabricate(:user, email: 'totp@example.com', password: password,
                       otp_required_for_login: true, otp_secret: User.generate_otp_secret(32))
    end

    before do
      post '/auth/sign_in', params: { user: { email: user.email, password: password } }
    end

    it 'asks for a code rather than signing in outright', :aggregate_failures do
      expect(response).to have_http_status(200)
      expect(response.body).to include('otp_attempt')
    end

    it 'signs in and redirects on a valid code', :aggregate_failures do
      post '/auth/sign_in', params: { user: { otp_attempt: user.reload.current_otp } }

      expect(response).to have_http_status(302)
      expect(flash[:alert]).to be_nil
      expect(signed_in?).to be true
    end

    it 'rejects an invalid code and does not sign in', :aggregate_failures do
      post '/auth/sign_in', params: { user: { otp_attempt: '000000' } }

      expect(response).to have_http_status(200)
      expect(signed_in?).to be false
    end
  end

  context 'with a recovery code' do
    let(:codes) { user.generate_otp_backup_codes! }
    let!(:user) do
      Fabricate(:user, email: 'recovery@example.com', password: password,
                       otp_required_for_login: true, otp_secret: User.generate_otp_secret(32))
    end

    before do
      code = codes.first
      user.save!
      post '/auth/sign_in', params: { user: { email: user.email, password: password } }
      post '/auth/sign_in', params: { user: { otp_attempt: code } }
    end

    it 'signs in and redirects', :aggregate_failures do
      expect(response).to have_http_status(302)
      expect(signed_in?).to be true
    end
  end
end
