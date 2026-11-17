# frozen_string_literal: true

require 'rails_helper'

# A projekt's threshold (docs/spaces/freethedream.md, The threshold): set in
# Edit, shown as a meter, and begun the first time it holds.
RSpec.describe 'API V1 FreeTheDream threshold' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:cara)  { Fabricate(:user) }
  let(:doof)  { Freethedream::Project.create!(title: 'Mini Doof', owner: alice.account) }
  let(:heard) { [] }

  before do
    allow(Kronk::KornerEvents).to receive(:publish).and_wrap_original do |original, name, **payload|
      heard << [name, payload[:recipient_account_id]] if name == Freethedream::Project::BEGUN
      original.call(name, **payload)
    end
  end

  def api(user, verb, path, params = {})
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    public_send(verb, "/api/v1#{path}", params: params, headers: { 'Authorization' => "Bearer #{token.token}" }, as: :json)
    response.parsed_body
  end

  def need(title, quantity: 1)
    api(alice, :post, '/freethedream/items', item: { project_id: doof.id, kind: 'need', title: title, quantity: quantity })
  end

  it 'has none until its owner sets one' do
    expect(api(alice, :get, "/freethedream/projects/#{doof.id}")['threshold']).to be_nil
  end

  it 'is set in Edit and shows where it stands', :aggregate_failures do
    Freethedream::Membership.create!(project: doof, account: bob.account, state: :member)
    need('PA')

    body = api(alice, :put, "/freethedream/projects/#{doof.id}", project: { threshold_people: 3, threshold_things: 2 })

    expect(response).to have_http_status(200)
    expect(body['threshold']).to eq(
      'people' => 3, 'things' => 2, 'people_count' => 2, 'things_sorted' => 0, 'begun_at' => nil
    )
  end

  it 'begins once enough people are in it, telling everyone but who tipped it', :aggregate_failures do
    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { threshold_people: 3 })
    Freethedream::Membership.create!(project: doof, account: bob.account, state: :member)
    expect(doof.reload).to_not be_begun

    Freethedream::Membership.create!(project: doof, account: cara.account, state: :member)

    expect(doof.reload).to be_begun
    expect(heard).to contain_exactly([Freethedream::Project::BEGUN, alice.account.id], [Freethedream::Project::BEGUN, bob.account.id])
  end

  it 'begins once enough things are sorted, brought or ticked off', :aggregate_failures do
    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { threshold_things: 2 })
    pa = need('PA')
    generator = need('Generator')

    api(alice, :post, "/freethedream/items/#{pa['id']}/bring", quantity: 1)
    expect(api(alice, :get, "/freethedream/projects/#{doof.id}")['threshold']).to include('things_sorted' => 1, 'begun_at' => nil)

    api(alice, :post, "/freethedream/items/#{generator['id']}/bring", quantity: 1)
    expect(api(alice, :get, "/freethedream/projects/#{doof.id}")['threshold']['begun_at']).to be_present
  end

  it 'stays begun when someone leaves, and forgets it when the threshold is taken off', :aggregate_failures do
    membership = Freethedream::Membership.create!(project: doof, account: bob.account, state: :member)
    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { threshold_people: 2 })
    expect(doof.reload).to be_begun

    membership.destroy!
    expect(doof.reload).to be_begun

    body = api(alice, :put, "/freethedream/projects/#{doof.id}", project: { threshold_people: nil })
    expect(body['threshold']).to be_nil
    expect(doof.reload.begun_at).to be_nil
  end

  it "is a projekt's own, and only its owner sets it", :aggregate_failures do
    Freethedream::Membership.create!(project: doof, account: bob.account, state: :member)
    api(bob, :put, "/freethedream/projects/#{doof.id}", project: { threshold_people: 5 })
    expect(response).to have_http_status(403)

    sound = api(alice, :post, '/freethedream/projects', project: { title: 'Sound', parent_id: doof.id })
    expect(api(alice, :put, "/freethedream/projects/#{sound['id']}", project: { threshold_people: 5 })['threshold']).to be_nil

    api(alice, :put, "/freethedream/projects/#{doof.id}", project: { threshold_people: 0 })
    expect(response).to have_http_status(422)
  end
end
