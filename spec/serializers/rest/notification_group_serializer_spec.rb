# frozen_string_literal: true

require 'rails_helper'

RSpec.describe REST::NotificationGroupSerializer do
  subject do
    serialized_record_json(
      notification_group,
      described_class
    )
  end

  let(:notification_group) { NotificationGroup.new pagination_data: { latest_notification_at: 3.days.ago }, notification: Fabricate(:notification), sample_accounts: [] }

  context 'when latest_page_notification_at is populated' do
    it 'parses as RFC 3339 datetime' do
      expect(subject)
        .to include(
          'latest_page_notification_at' => match_api_datetime_format
        )
    end
  end

  # proposal_challenged and task_assigned were registered and firing with
  # NOTHING serialised, so the client had no payload to render and the
  # notifications were invisible. These pin the payloads, including that each
  # attribute appears only for its own type — a serializer that emits a key for
  # every type is as misleading as one that emits none.
  # See docs/rebuild/notification_retirement_plan.md phase 1.
  describe 'Kommons system payloads' do
    def json_for(notification)
      serialized_record_json(
        NotificationGroup.new(
          pagination_data: { latest_notification_at: 1.hour.ago },
          notification: notification,
          sample_accounts: []
        ),
        described_class
      )
    end

    let(:proposal) { Fabricate(:proposal, title: 'Fix the boardwalk') }
    let(:challenger) { Fabricate(:account) }

    context 'with proposal_challenged' do
      let(:notification) { Fabricate(:notification, type: :proposal_challenged, activity: proposal, from_account: challenger) }

      it 'exposes the proposal id and title' do
        expect(json_for(notification)['proposal'])
          .to include('proposal_id' => proposal.id.to_s, 'proposal_title' => 'Fix the boardwalk')
      end

      it 'does not emit a task payload' do
        expect(json_for(notification)).to_not have_key('task')
      end
    end

    context 'with task_assigned' do
      let(:task) { Fabricate(:task, proposal: proposal, title: 'Order timber') }
      let(:notification) { Fabricate(:notification, type: :task_assigned, activity: task, from_account: challenger) }

      it 'exposes the task and its parent proposal id, since tasks have no route' do
        expect(json_for(notification)['task'])
          .to include(
            'task_id' => task.id.to_s,
            'task_title' => 'Order timber',
            'proposal_id' => proposal.id.to_s
          )
      end

      it 'does not emit a proposal payload' do
        expect(json_for(notification)).to_not have_key('proposal')
      end
    end
  end
end
