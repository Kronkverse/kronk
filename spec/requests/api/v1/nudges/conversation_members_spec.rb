# frozen_string_literal: true

require 'rails_helper'

# A chat's Members list in its settings (docs/spaces/nudges.md, Chat settings).
RSpec.describe 'Nudges conversation members' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:notifications') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:ben)     { Fabricate(:account, username: 'ben') }
  let(:krew)    { Krew.create!(slug: 'growers', name: 'Growers', access: 'open') }

  def join(account)
    krew.krew_memberships.create!(account: account, role: 'member', source: 'direct')
  end

  it 'lists a Krew chat’s people in the order they joined' do
    join(me)
    join(ben)
    conversation = Nudges::Conversation.krew_for!(krew)

    get "/api/v1/nudges/conversations/#{conversation.id}/members", headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body.pluck('id')).to eq [me.id.to_s, ben.id.to_s]
  end

  it 'lists a projekt chat’s accepted members' do
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: me)
    conversation = Nudges::Conversation.projekt_for!(doof)
    conversation.memberships.create!(account: ben, invited_by: me)

    get "/api/v1/nudges/conversations/#{conversation.id}/members", headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body.pluck('id')).to include(me.id.to_s)
    expect(response.parsed_body.pluck('id')).to_not include(ben.id.to_s)
  end

  it 'is not found for someone outside the chat' do
    join(ben)
    conversation = Nudges::Conversation.krew_for!(krew)

    get "/api/v1/nudges/conversations/#{conversation.id}/members", headers: headers

    expect(response).to have_http_status(404)
  end
end
