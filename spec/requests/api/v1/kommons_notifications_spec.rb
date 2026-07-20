# frozen_string_literal: true

require 'rails_helper'

# The two Kommons notification producers wired in §5.7: a block vote notifies
# the proposer (proposal_challenged), and assigning a task notifies the
# assignee (task_assigned).
RSpec.describe 'Kommons notification producers' do
  let(:author)     { Fabricate(:account) }
  let(:actor_user) { Fabricate(:user) }
  let(:token)      { Fabricate(:accessible_access_token, resource_owner_id: actor_user.id, scopes: 'read write') }
  let(:headers)    { { 'Authorization' => "Bearer #{token.token}" } }
  let(:proposal)   { Proposal.create!(title: 'Build it', body: 'Please build this', created_by_account_id: author.id) }

  describe 'proposal_challenged' do
    it 'notifies the proposer when someone casts a block vote' do
      expect do
        post "/api/v1/proposals/#{proposal.id}/vote",
             params: { vote: { position: 'block', title: 'Concern', statement: 'This needs more thought before we proceed.' } },
             headers: headers
      end.to change { Notification.where(account_id: author.id, type: 'proposal_challenged').count }.by(1)

      expect(response).to have_http_status(200)
    end

    it 'does not notify on an agree vote' do
      expect do
        post "/api/v1/proposals/#{proposal.id}/vote",
             params: { vote: { position: 'agree' } },
             headers: headers
      end.to_not change(Notification, :count)
    end
  end

  describe 'task_assigned' do
    let(:assignee) { Fabricate(:account) }

    it 'notifies the assignee when a task is assigned to them' do
      expect do
        post "/api/v1/proposals/#{proposal.id}/tasks",
             params: { task: { title: 'Do the thing', assigned_to_account_id: assignee.id } },
             headers: headers
      end.to change { Notification.where(account_id: assignee.id, type: 'task_assigned').count }.by(1)

      expect(response).to have_http_status(201)
    end

    it 'does not notify when a task is created unassigned' do
      expect do
        post "/api/v1/proposals/#{proposal.id}/tasks",
             params: { task: { title: 'Unassigned work' } },
             headers: headers
      end.to_not change(Notification, :count)
    end
  end
end
