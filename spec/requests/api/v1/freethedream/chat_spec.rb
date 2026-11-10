# frozen_string_literal: true

require 'rails_helper'

# A projekt's chat (docs/spaces/freethedream.md, Chat): a Nudges group chat
# for its members, on from the start and turned off and on from Edit, in
# place of Talk.
RSpec.describe 'API V1 FreeTheDream chat' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:cara)  { Fabricate(:user) }
  let(:doof)  { Freethedream::Project.create!(title: 'Mini Doof', owner: alice.account) }

  def api(user, verb, path, params = {})
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    public_send(verb, "/api/v1#{path}", params: params, headers: { 'Authorization' => "Bearer #{token.token}" }, as: :json)
    response.parsed_body
  end

  it 'turns on from Edit, with everyone in the projekt in it', :aggregate_failures do
    Freethedream::Membership.create!(project: doof, account: bob.account, state: :member)

    body = api(alice, :put, "/freethedream/projects/#{doof.id}", project: { chat: true })
    expect(body['spaces']).to include('nudges')

    chat = api(bob, :get, "/freethedream/projects/#{doof.id}/chat")
    conversation = Nudges::Conversation.find(chat['conversation_id'])
    expect(conversation).to have_attributes(kind: 'projekt', freethedream_project_id: doof.id)
    expect(conversation.memberships.pluck(:account_id)).to contain_exactly(alice.account.id, bob.account.id)
  end

  it 'starts on for a new projekt, not for its Komponents', :aggregate_failures do
    made = api(alice, :post, '/freethedream/projects', project: { title: 'Camp', krew_id: Fabricate(:krew, seeded_by: alice.account).id })
    expect(made['spaces']).to include('nudges')
    expect(Nudges::Conversation.where(kind: 'projekt', freethedream_project_id: made['id'])).to exist

    part = api(alice, :post, '/freethedream/projects', project: { title: 'Tents', parent_id: made['id'] })
    expect(part['spaces']).to be_empty
  end

  it 'brings in whoever joins later, and lets go of whoever leaves' do
    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { chat: true })
    conversation = Nudges::Conversation.find_by!(kind: 'projekt', freethedream_project: doof)

    membership = Freethedream::Membership.create!(project: doof, account: cara.account, state: :member)
    expect(conversation.memberships.exists?(account_id: cara.account.id)).to be true

    membership.destroy!
    expect(conversation.memberships.exists?(account_id: cara.account.id)).to be false
  end

  it 'is listed in Nudges with the projekt as its name', :aggregate_failures do
    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { chat: true })

    rows = api(alice, :get, '/nudges/conversations')
    row = Array(rows).find { |r| r['kind'] == 'projekt' }
    expect(row).to be_present
    expect(row['krew']).to include('name' => 'Mini Doof', 'member_count' => 1)
  end

  it 'is for members only, and gone once turned off', :aggregate_failures do
    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { chat: true })

    api(bob, :get, "/freethedream/projects/#{doof.id}/chat")
    expect(response.status).to be_in([403, 404])

    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { chat: false })
    api(alice, :get, "/freethedream/projects/#{doof.id}/chat")
    expect(response).to have_http_status(404)
    expect(Nudges::Conversation.listable.for_account(alice.account).where(kind: 'projekt')).to be_empty
  end
end
