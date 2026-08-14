# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Settings Sessions' do
  let(:user) { Fabricate(:user) }

  # A SessionActivation mints its own access token on create (the model's
  # before_create hook), so the realistic "current device" is the session
  # whose own token the request authenticates with. Its default scopes
  # (read write follow) satisfy the controller's read/write:accounts gates.
  let(:current_session) { Fabricate(:session_activation, user: user) }
  let(:token)           { current_session.access_token }
  let(:headers)         { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/settings/sessions' do
    it "lists only the user's sessions and flags the active one" do
      other = Fabricate(:session_activation, user: user)
      Fabricate(:session_activation, user: Fabricate(:user)) # a different user's session

      get '/api/v1/settings/sessions', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck('id')).to contain_exactly(current_session.id.to_s, other.id.to_s)

      rows = response.parsed_body.index_by { |row| row['id'] }
      expect(rows[current_session.id.to_s]['current']).to be(true)
      expect(rows[other.id.to_s]['current']).to be(false)
    end
  end

  describe 'DELETE /api/v1/settings/sessions/:id' do
    it 'revokes another of the user\'s sessions' do
      other = Fabricate(:session_activation, user: user)

      expect { delete "/api/v1/settings/sessions/#{other.id}", headers: headers }
        .to change { user.session_activations.exists?(other.id) }.from(true).to(false)
      expect(response).to have_http_status(200)
    end

    it 'refuses to revoke the current session' do
      delete "/api/v1/settings/sessions/#{current_session.id}", headers: headers

      expect(response).to have_http_status(422)
      expect(user.session_activations.exists?(current_session.id)).to be(true)
    end

    it 'is a 404 for a session that belongs to another user (and leaves it intact)' do
      theirs = Fabricate(:session_activation, user: Fabricate(:user))

      delete "/api/v1/settings/sessions/#{theirs.id}", headers: headers

      expect(response).to have_http_status(404)
      expect(SessionActivation.exists?(theirs.id)).to be(true)
    end
  end
end
