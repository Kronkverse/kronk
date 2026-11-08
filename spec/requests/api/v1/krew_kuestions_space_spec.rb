# frozen_string_literal: true

require 'rails_helper'

# Kuestions is a space a Krew turns on (decisions.md, 2026-11-08), and what
# its Ask sends keeps the Kuestion to the Krew's members.
RSpec.describe 'Kuestions as a Krew space' do
  let(:member)   { Fabricate(:user) }
  let(:outsider) { Fabricate(:user) }
  let(:krew)     { Fabricate(:krew, seeded_by: member.account, access: 'open') }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  describe 'turning it on and off' do
    it 'is a space a member turns on and off', :aggregate_failures do
      post "/api/v1/krews/#{krew.id}/attach", params: { korner: 'kuestions' }, headers: headers_for(member)
      expect(response).to have_http_status(200)
      expect(response.parsed_body[:korners]).to include('kuestions')

      delete "/api/v1/krews/#{krew.id}/attach/kuestions", headers: headers_for(member)
      expect(response).to have_http_status(200)
      expect(krew.reload.krew_korners.pluck(:korner)).to_not include('kuestions')
    end

    it 'keeps its Kuestions when it is turned off' do
      krew.krew_korners.create!(korner: 'kuestions')
      question = Question.create!(title: 'Who brings the generator?', created_by_account: member.account, krew: krew, locked: true)

      delete "/api/v1/krews/#{krew.id}/attach/kuestions", headers: headers_for(member)

      expect(Question.exists?(question.id)).to be true
    end
  end

  # Exactly what HomeKuestionComposer sends.
  describe 'what the Krew page Ask sends' do
    let(:payload) { { title: 'Which weekend for the harvest?', answer_format: 'mc', mc_options: %w(First Second), kind: 'community', krew_id: krew.id.to_s } }

    it 'makes a Kuestion only its members see, anywhere', :aggregate_failures do
      post '/api/v2/kuestions', params: payload, headers: headers_for(member)
      expect(response).to have_http_status(201)
      question = Question.find(response.parsed_body[:id])
      expect(question).to have_attributes(krew_id: krew.id, status_id: nil)

      get "/api/v2/kuestions/#{question.id}", headers: headers_for(outsider)
      expect(response).to have_http_status(404)

      get '/api/v2/kuestions', headers: headers_for(outsider)
      expect(response.parsed_body.pluck(:id)).to_not include(question.id.to_s)

      get '/api/v2/kuestions', params: { filter: 'involved' }, headers: headers_for(outsider)
      expect(response.parsed_body.pluck(:id)).to_not include(question.id.to_s)

      get '/api/v1/timelines/public', headers: headers_for(outsider)
      expect(response.parsed_body.pluck(:content).join).to_not include('Which weekend for the harvest?')
    end
  end

  describe 'a projekt' do
    let(:project) { Freethedream::Project.create!(title: 'Doof', owner: member.account, krew: krew) }

    it 'says whether its Krew has Kuestions on', :aggregate_failures do
      get "/api/v1/freethedream/projects/#{project.id}", headers: headers_for(member)
      expect(response.parsed_body.dig(:krew, :kuestions)).to be false

      krew.krew_korners.create!(korner: 'kuestions')
      get "/api/v1/freethedream/projects/#{project.id}", headers: headers_for(member)
      expect(response.parsed_body.dig(:krew, :kuestions)).to be true
    end
  end
end
