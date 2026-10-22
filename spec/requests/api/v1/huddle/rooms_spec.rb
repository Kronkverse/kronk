# frozen_string_literal: true

require 'rails_helper'

# Making a Room (docs/spaces/huddle.md § Rooms): a name and a line, no
# icon, and optionally a Krew the maker is in, which the Room is Konnected
# to in the same request.
RSpec.describe 'Huddle rooms' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:krew)    { Krew.create!(slug: 'gardeners', name: 'Gardeners', access: 'open') }

  before { Kronk::KornerRegistry.reload! }

  def linked?(room_id)
    Kronk::AttachmentEffects.between('huddle', room_id, 'krew', krew.id).exists?
  end

  describe 'POST /api/v1/huddle/rooms' do
    it 'makes an open Room and keeps no icon' do
      post '/api/v1/huddle/rooms', headers: headers, params: { name: 'Quiet study', description: 'Heads down', icon: '📚' }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to_not have_key('icon')
      room = HuddleSession.find(response.parsed_body['id'])
      expect(room).to have_attributes(scope: 'room', title: 'Quiet study', description: 'Heads down', icon: nil)
      expect(KornerAttachment.from_source('huddle', room.id)).to be_empty
    end

    it 'Konnects the Room to a Krew the maker is in' do
      krew.krew_memberships.create!(account: user.account)

      post '/api/v1/huddle/rooms', headers: headers, params: { name: 'Seed swap call', krew_id: krew.id }

      expect(response).to have_http_status(200)
      room = HuddleSession.find(response.parsed_body['id'])
      expect(room.scope).to eq('room')
      expect(linked?(room.id)).to be(true)
      expect(KornerAttachment.from_source('huddle', room.id).first).to have_attributes(
        target_slug: 'krew', target_id: krew.id, kind: 'link', created_by_account_id: user.account.id
      )
    end

    it 'refuses a Krew the maker is not in, and makes no Room' do
      expect do
        post '/api/v1/huddle/rooms', headers: headers, params: { name: 'Gatecrash', krew_id: krew.id }
      end.to_not change(HuddleSession, :count)

      expect(response).to have_http_status(422)
    end

    it 'refuses an archived Krew' do
      krew.krew_memberships.create!(account: user.account)
      krew.update!(archived_at: Time.current)

      post '/api/v1/huddle/rooms', headers: headers, params: { name: 'Late', krew_id: krew.id }

      expect(response).to have_http_status(422)
    end

    it 'answers an unknown Krew the same way' do
      post '/api/v1/huddle/rooms', headers: headers, params: { name: 'Guess', krew_id: 0 }

      expect(response).to have_http_status(422)
    end

    it 'needs a name' do
      post '/api/v1/huddle/rooms', headers: headers, params: { name: '  ' }

      expect(response).to have_http_status(422)
    end
  end
end
