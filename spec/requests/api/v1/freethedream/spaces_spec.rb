# frozen_string_literal: true

require 'rails_helper'

# A projekt's spaces (docs/spaces/freethedream.md, A projekt's spaces):
# Konnect turns one on, Edit orders them, and one it already has something
# in shows without being turned on.
RSpec.describe 'API V1 FreeTheDream spaces' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:doof)  { Freethedream::Project.create!(title: 'Mini Doof', owner: alice.account) }

  def api(user, verb, path, params = {})
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses')
    public_send(verb, "/api/v1#{path}", params: params, headers: { 'Authorization' => "Bearer #{token.token}" }, as: :json)
    response.parsed_body
  end

  it 'turns a space on for its owner, and only a known one', :aggregate_failures do
    body = api(alice, :post, "/freethedream/projects/#{doof.id}/spaces", korner: 'albutts')
    expect(response).to have_http_status(200)
    expect(body['spaces']).to eq ['albutts']

    api(alice, :post, "/freethedream/projects/#{doof.id}/spaces", korner: 'wachuneed')
    expect(response).to have_http_status(422)
    expect(doof.reload.spaces).to eq ['albutts']
  end

  it 'refuses anyone else, and a Komponent', :aggregate_failures do
    api(bob, :post, "/freethedream/projects/#{doof.id}/spaces", korner: 'albutts')
    expect(response.status).to be_in([403, 404])

    kitchen = Freethedream::Project.create!(title: 'Kitchen', owner: alice.account, parent: doof, root: doof)
    api(alice, :post, "/freethedream/projects/#{kitchen.id}/spaces", korner: 'albutts')
    expect(response).to have_http_status(403)
    expect(kitchen.reload.spaces).to eq []
  end

  it 'saves the page order from Edit, dropping anything unknown' do
    doof.update!(spaces: %w(kalendar kronikles))
    body = api(alice, :put, "/freethedream/projects/#{doof.id}", project: { section_order: %w(kronikles nonsense updates kronikles) })

    expect(body['section_order']).to eq %w(kronikles updates)
  end

  it 'shows a space it already has something in' do
    question = Question.new(created_by_account_id: alice.account.id, title: 'Who brings the urn?', freethedream_project: doof)
    question.save!(validate: false)

    expect(api(alice, :get, "/freethedream/projects/#{doof.id}")['spaces']).to eq ['kuestions']
  end
end
