# frozen_string_literal: true

require 'rails_helper'

# Nobody owns a Krew (docs/decisions.md, 2026-10-17): any member can change
# it, only a sole member can archive it, and the last one out archives it.
RSpec.describe 'API V1 Krews with no owner' do
  let(:seeder)   { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:outsider) { Fabricate(:user) }

  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'invite_only', invite_token: 'letmein',
                 seeded_by: seeder.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: seeder.account, role: 'seeder', source: 'direct')
      k.krew_memberships.create!(account: member.account, role: 'member', source: 'direct')
    end
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  describe 'a member who did not start the Krew' do
    it 'adds and removes a space' do
      post "/api/v1/krews/#{krew.slug}/attach", headers: headers_for(member), params: { korner: 'albutts' }
      expect(response).to have_http_status(200)
      expect(krew.reload.krew_korners.pluck(:korner)).to eq ['albutts']

      delete "/api/v1/krews/#{krew.slug}/attach/albutts", headers: headers_for(member)
      expect(response).to have_http_status(200)
      expect(krew.reload.krew_korners).to be_empty
    end

    it 'renames it and changes who can join' do
      patch "/api/v1/krews/#{krew.slug}", headers: headers_for(member), params: { name: 'Gardeners', access: 'open' }

      expect(response).to have_http_status(200)
      expect(krew.reload).to have_attributes(name: 'Gardeners', access: 'open')
    end

    it 'sees and rotates the invite link' do
      get "/api/v1/krews/#{krew.slug}", headers: headers_for(member)
      expect(response.parsed_body['invite_token']).to eq 'letmein'

      post "/api/v1/krews/#{krew.slug}/regenerate_invite", headers: headers_for(member)
      expect(response).to have_http_status(200)
      expect(krew.reload.invite_token).to_not eq 'letmein'
    end

    it 'adds a requirement' do
      post "/api/v1/krews/#{krew.slug}/requirements", headers: headers_for(member), params: { kind: 'located_in', region: 'Melbourne' }

      expect(response).to have_http_status(200)
      expect(krew.krew_requirements.count).to eq 1
    end
  end

  describe 'someone outside the Krew' do
    it 'cannot change it or see the invite link' do
      post "/api/v1/krews/#{krew.slug}/attach", headers: headers_for(outsider), params: { korner: 'albutts' }
      expect(response).to have_http_status(403)

      get "/api/v1/krews/#{krew.slug}", headers: headers_for(outsider)
      expect(response.parsed_body['invite_token']).to be_nil
    end
  end

  describe 'archiving' do
    it 'is refused while anyone else is in the Krew, the person who started it included' do
      delete "/api/v1/krews/#{krew.slug}", headers: headers_for(seeder)

      expect(response).to have_http_status(403)
      expect(krew.reload.archived?).to be false
    end

    it 'is allowed for a sole member' do
      krew.krew_memberships.where(account: seeder.account).destroy_all

      delete "/api/v1/krews/#{krew.slug}", headers: headers_for(member)

      expect(response).to have_http_status(200)
      expect(krew.reload.archived?).to be true
    end
  end

  describe 'leaving' do
    it 'lets the person who started it leave, and the Krew carries on' do
      post "/api/v1/krews/#{krew.slug}/leave", headers: headers_for(seeder)

      expect(response).to have_http_status(200)
      expect(krew.reload).to have_attributes(archived?: false, member_count: 1)
    end

    it 'archives the Krew when the last member leaves' do
      post "/api/v1/krews/#{krew.slug}/leave", headers: headers_for(seeder)
      post "/api/v1/krews/#{krew.slug}/leave", headers: headers_for(member)

      expect(response).to have_http_status(200)
      expect(krew.reload.archived?).to be true
    end
  end
end
