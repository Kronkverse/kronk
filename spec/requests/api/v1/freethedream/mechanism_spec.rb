# frozen_string_literal: true

require 'rails_helper'

# FreeTheDream's mechanism, walked through a mini doof
# (docs/spaces/freethedream.md, "The mechanism").
RSpec.describe 'API V1 FreeTheDream mechanism' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:cara)  { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def api(user, verb, path, params = {})
    public_send(verb, "/api/v1/freethedream#{path}", params: params, headers: headers_for(user), as: :json)
    response.parsed_body
  end

  def start_project(user, **attrs)
    api(user, :post, '/projects', project: { title: 'Mini Doof' }.merge(attrs))
  end

  it 'refuses signed-out requests' do
    get '/api/v1/freethedream/projects'
    expect(response).to have_http_status(401)
  end

  describe 'projects and parts' do
    it 'starts a project run by its creator, who is its first member', :aggregate_failures do
      body = start_project(alice)

      expect(response).to have_http_status(201)
      expect(body['owner']['id']).to eq alice.account_id.to_s
      expect(body['membership']).to eq 'member'
      expect(body['can']).to include('add' => true, 'edit' => true)
      expect(api(bob, :get, '/projects').pluck('title')).to include('Mini Doof')
    end

    it 'lets anyone who has joined add a part, owned by them', :aggregate_failures do
      doof = start_project(alice)

      api(bob, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })
      expect(response).to have_http_status(403)

      api(bob, :post, "/projects/#{doof['id']}/join")
      stage = api(bob, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })
      expect(response).to have_http_status(201)
      expect(stage['owner']['id']).to eq bob.account_id.to_s
      expect(stage['ancestors'].pluck('title')).to eq ['Mini Doof']

      lighting = api(bob, :post, '/projects', project: { title: 'Lighting', parent_id: stage['id'] })
      expect(lighting['ancestors'].pluck('title')).to eq ['Mini Doof', 'Live Stage']
    end

    it 'lets only the owner change a part', :aggregate_failures do
      doof = start_project(alice)
      api(bob, :post, "/projects/#{doof['id']}/join")
      stage = api(bob, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })

      api(alice, :put, "/projects/#{stage['id']}", project: { title: 'Main Stage' })
      expect(response).to have_http_status(403)

      body = api(bob, :put, "/projects/#{stage['id']}", project: { done: true })
      expect(body['done']).to be true
    end

    it "refuses to remove a project holding someone else's work", :aggregate_failures do
      doof = start_project(alice)
      api(bob, :post, "/projects/#{doof['id']}/join")
      api(bob, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })

      expect(api(alice, :get, "/projects/#{doof['id']}")['can']['remove']).to be false
      api(alice, :delete, "/projects/#{doof['id']}")
      expect(response).to have_http_status(403)
    end

    it 'removes a part with everything only it held', :aggregate_failures do
      doof = start_project(alice)
      kitchen = api(alice, :post, '/projects', project: { title: 'Kitchen', parent_id: doof['id'] })
      need = api(alice, :post, '/items', item: { project_id: kitchen['id'], kind: 'need', title: 'Pots' })

      api(alice, :delete, "/projects/#{kitchen['id']}")
      expect(response).to have_http_status(200)
      expect(Freethedream::Item.exists?(need['id'])).to be false
    end
  end

  describe 'joining' do
    it 'joins an open project in one tap' do
      doof = start_project(alice)
      expect(api(bob, :post, "/projects/#{doof['id']}/join")['membership']).to eq 'member'
    end

    it 'asks to join a by-request project, and the owner accepts', :aggregate_failures do
      house = start_project(alice, title: 'Communal house', joining: 'by_request')

      expect(api(bob, :post, "/projects/#{house['id']}/join")['membership']).to eq 'requested'
      expect(api(alice, :get, "/projects/#{house['id']}")['requests'].pluck('id')).to eq [bob.account_id.to_s]

      api(cara, :post, "/projects/#{house['id']}/requests/#{bob.account_id}/accept")
      expect(response).to have_http_status(403)

      api(alice, :post, "/projects/#{house['id']}/requests/#{bob.account_id}/accept")
      expect(api(bob, :get, "/projects/#{house['id']}")['membership']).to eq 'member'
    end

    it 'leaves what you made up for grabs when you leave, and anyone in can take it over', :aggregate_failures do
      doof = start_project(alice)
      api(bob, :post, "/projects/#{doof['id']}/join")
      api(cara, :post, "/projects/#{doof['id']}/join")
      stage = api(bob, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })

      api(bob, :post, "/projects/#{doof['id']}/leave")
      body = api(cara, :get, "/projects/#{stage['id']}")
      expect(body['up_for_grabs']).to be true
      expect(body['can']['take_over']).to be true

      expect(api(cara, :post, "/projects/#{stage['id']}/take_over")['owner']['id']).to eq cara.account_id.to_s
    end

    it 'hands a part to another member', :aggregate_failures do
      doof = start_project(alice)
      api(bob, :post, "/projects/#{doof['id']}/join")
      kitchen = api(alice, :post, '/projects', project: { title: 'Kitchen', parent_id: doof['id'] })

      api(alice, :post, "/projects/#{kitchen['id']}/hand_over", account_id: cara.account_id)
      expect(response).to have_http_status(403)

      body = api(alice, :post, "/projects/#{kitchen['id']}/hand_over", account_id: bob.account_id)
      expect(body['owner']['id']).to eq bob.account_id.to_s
    end
  end

  describe 'items' do
    let!(:doof) { start_project(alice) }

    before do
      api(bob, :post, "/projects/#{doof['id']}/join")
      api(cara, :post, "/projects/#{doof['id']}/join")
    end

    it 'counts offers against a need straight away, and shows spares', :aggregate_failures do
      need = api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'need', title: 'Generator', category: 'things', quantity: 1 })

      api(bob, :post, '/items', item: { need_id: need['id'], title: 'My generator', quantity: 1 })
      api(cara, :post, '/items', item: { need_id: need['id'], title: 'Spare generator', quantity: 1 })

      body = api(alice, :get, "/items/#{need['id']}")
      expect(body).to include('covered' => 2, 'spare' => 1)
      expect(body['offers'].pluck('kind')).to all(eq 'offer')
    end

    it 'treats money as just another need', :aggregate_failures do
      need = api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'need', title: 'Permits', category: 'money', quantity: 400 })
      api(bob, :post, '/items', item: { need_id: need['id'], title: 'Towards permits', quantity: 150 })

      expect(api(alice, :get, "/items/#{need['id']}")).to include('covered' => 150, 'spare' => 0)
    end

    it 'fills a job slot by slot', :aggregate_failures do
      job = api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'job', title: 'Set-up crew', quantity: 2 })

      api(bob, :post, "/items/#{job['id']}/claim")
      expect(api(cara, :post, "/items/#{job['id']}/claim")['claimed']).to eq 2

      api(alice, :post, "/items/#{job['id']}/claim")
      expect(response).to have_http_status(422)

      api(bob, :post, "/items/#{job['id']}/unclaim")
      expect(api(alice, :post, "/items/#{job['id']}/claim")['claimed_by_me']).to be true
    end

    it 'turns an idea into a part owned by whoever takes it on', :aggregate_failures do
      idea = api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'idea', title: 'Fire twirler' })

      result = api(bob, :post, "/items/#{idea['id']}/take_on", as: 'part')
      part = api(bob, :get, "/projects/#{result['id']}")
      expect(part['owner']['id']).to eq bob.account_id.to_s
      expect(part['source_idea']['id']).to eq idea['id']
      expect(api(cara, :get, "/items/#{idea['id']}")['taken_on']['id']).to eq result['id']

      api(cara, :post, "/items/#{idea['id']}/take_on", as: 'job')
      expect(response).to have_http_status(403)
    end

    it 'shows one item in several parts', :aggregate_failures do
      stage = api(alice, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })
      kitchen = api(alice, :post, '/projects', project: { title: 'Kitchen', parent_id: doof['id'] })
      need = api(alice, :post, '/items', item: { project_id: stage['id'], kind: 'need', title: 'Generator' })

      api(bob, :post, "/items/#{need['id']}/placements", project_id: kitchen['id'])
      expect(api(alice, :get, "/projects/#{kitchen['id']}")['items'].pluck('id')).to include(need['id'])
    end

    it 'links parts as dependencies, but not in a loop', :aggregate_failures do
      stage = api(alice, :post, '/projects', project: { title: 'Live Stage', parent_id: doof['id'] })
      power = api(alice, :post, '/projects', project: { title: 'Power', parent_id: doof['id'] })

      body = api(bob, :post, "/projects/#{stage['id']}/dependencies", depends_on_id: power['id'])
      expect(body['depends_on'].pluck('title')).to eq ['Power']
      expect(api(bob, :get, "/projects/#{power['id']}")['needed_by'].pluck('title')).to eq ['Live Stage']

      api(bob, :post, "/projects/#{power['id']}/dependencies", depends_on_id: stage['id'])
      expect(response).to have_http_status(422)
    end

    it 'lets only the owner change an item, and members comment', :aggregate_failures do
      need = api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'need', title: 'PA system' })

      api(bob, :put, "/items/#{need['id']}", item: { title: 'Big PA' })
      expect(response).to have_http_status(403)

      api(bob, :post, '/comments', subject_type: 'item', subject_id: need['id'], body: 'I know someone with one')
      expect(api(alice, :get, "/items/#{need['id']}")['comments'].pluck('body')).to eq ['I know someone with one']

      outsider = Fabricate(:user)
      api(outsider, :post, '/comments', subject_type: 'item', subject_id: need['id'], body: 'hi')
      expect(response).to have_http_status(403)
    end
  end

  describe 'inventory and the audit' do
    it 'keeps your inventory private until you share it with a project you are in', :aggregate_failures do
      doof = start_project(alice)
      api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'need', title: 'Generator', category: 'things' })
      generator = api(bob, :post, '/assets', asset: { category: 'things', title: 'Generator' })
      expect(api(alice, :get, '/assets')).to be_empty

      api(bob, :post, "/assets/#{generator['id']}/share", project_id: doof['id'])
      expect(response).to have_http_status(422)

      api(bob, :post, "/projects/#{doof['id']}/join")
      expect(api(bob, :post, "/assets/#{generator['id']}/share", project_id: doof['id'])['shared_with'].pluck('title')).to eq ['Mini Doof']

      things = api(alice, :get, "/projects/#{doof['id']}/audit")['categories'].find { |c| c['category'] == 'things' }
      expect(things['needs'].pluck('title')).to eq ['Generator']
      expect(things['shared'].pluck('title')).to eq ['Generator']

      api(cara, :get, "/projects/#{doof['id']}/audit")
      expect(response).to have_http_status(403)
    end

    it 'frees your job slots when you leave' do
      doof = start_project(alice)
      api(bob, :post, "/projects/#{doof['id']}/join")
      job = api(alice, :post, '/items', item: { project_id: doof['id'], kind: 'job', title: 'Sound tech' })
      api(bob, :post, "/items/#{job['id']}/claim")

      api(bob, :post, "/projects/#{doof['id']}/leave")
      expect(api(alice, :get, "/items/#{job['id']}")['claimed']).to eq 0
    end

    it 'takes your shares out when you leave' do
      doof = start_project(alice)
      api(bob, :post, "/projects/#{doof['id']}/join")
      van = api(bob, :post, '/assets', asset: { category: 'things', title: 'Van' })
      api(bob, :post, "/assets/#{van['id']}/share", project_id: doof['id'])

      api(bob, :post, "/projects/#{doof['id']}/leave")
      expect(api(bob, :get, '/assets').first['shared_with']).to be_empty
    end
  end
end
