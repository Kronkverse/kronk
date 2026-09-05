# frozen_string_literal: true

require 'rails_helper'

# Authorization guards on Kommons proposal tasks. A task may only be created or
# changed by the proposal's creator (or a steward). Without this, any user could
# inject tasks or mark them done — which force-delivers the proposal.
RSpec.describe 'Api::V1::Tasks authorization' do
  let(:owner)    { Fabricate(:user) }
  let(:proposal) { Proposal.create!(title: 'Build it', body: 'Please build this', created_by_account_id: owner.account.id) }
  let(:task)     { Task.create!(proposal: proposal, title: 'Do the thing') }

  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'POST /api/v1/proposals/:proposal_id/tasks' do
    context 'when the caller is a stranger' do
      let(:stranger) { Fabricate(:user) }
      let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: stranger.id, scopes: 'read write') }

      it 'is forbidden' do
        expect do
          post "/api/v1/proposals/#{proposal.id}/tasks", params: { task: { title: 'Injected' } }, headers: headers
        end.to_not(change { proposal.tasks.count })

        expect(response).to have_http_status(403)
      end
    end

    context 'when the caller is the proposal creator' do
      let(:token) { Fabricate(:accessible_access_token, resource_owner_id: owner.id, scopes: 'read write') }

      it 'creates the task' do
        post "/api/v1/proposals/#{proposal.id}/tasks", params: { task: { title: 'Legit' } }, headers: headers
        expect(response).to have_http_status(201)
      end
    end

    context 'with a read-only token' do
      let(:token) { Fabricate(:accessible_access_token, resource_owner_id: owner.id, scopes: 'read') }

      it 'is rejected for insufficient scope' do
        post "/api/v1/proposals/#{proposal.id}/tasks", params: { task: { title: 'Nope' } }, headers: headers
        expect(response).to have_http_status(403)
      end
    end
  end

  describe 'PATCH /api/v1/tasks/:id' do
    context 'when the caller is a stranger' do
      let(:stranger) { Fabricate(:user) }
      let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: stranger.id, scopes: 'read write') }

      it 'is forbidden and does not mutate the task' do
        patch "/api/v1/tasks/#{task.id}", params: { task: { status: 'done' } }, headers: headers

        expect(response).to have_http_status(403)
        expect(task.reload.status).to eq('open')
      end
    end

    context 'when the caller is the proposal creator' do
      let(:token) { Fabricate(:accessible_access_token, resource_owner_id: owner.id, scopes: 'read write') }

      it 'updates the task' do
        patch "/api/v1/tasks/#{task.id}", params: { task: { status: 'in_progress' } }, headers: headers
        expect(response).to have_http_status(200)
        expect(task.reload.status).to eq('in_progress')
      end
    end
  end

  # Auto-deliver behaviour (spec: docs/spaces/kommons.md §Anti-gaming).
  # Ticking the LAST task done transitions the proposal to :delivered,
  # but only when the actor is not the proposer — the proposer walking
  # their own proposal through delivery and completing it would let
  # them farm the ₭ payout. Stewards (admins/mods) and the shell
  # remain the sanctioned delivery paths.
  describe 'PATCH /api/v1/tasks/:id — auto-deliver' do
    let(:last_task) { Task.create!(proposal: proposal, title: 'Ship it') }

    context 'when the proposer ticks their own last task done' do
      let(:token) { Fabricate(:accessible_access_token, resource_owner_id: owner.id, scopes: 'read write') }

      it 'does NOT auto-deliver the proposal' do
        patch "/api/v1/tasks/#{last_task.id}", params: { task: { status: 'done' } }, headers: headers

        expect(response).to have_http_status(200)
        expect(proposal.reload.status).to eq('open')
      end
    end

    context 'when a steward ticks the last task done' do
      let(:steward) { Fabricate(:admin_user) }
      let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: steward.id, scopes: 'read write') }

      it 'auto-delivers the proposal' do
        patch "/api/v1/tasks/#{last_task.id}", params: { task: { status: 'done' } }, headers: headers

        expect(response).to have_http_status(200)
        expect(proposal.reload.status).to eq('delivered')
      end
    end
  end
end
