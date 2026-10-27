# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CallRecordingPolicy do
  let(:member) { Fabricate(:user).account }
  let(:maker)  { Fabricate(:user).account }
  let(:staff)  { Fabricate(:moderator_user).account }
  let(:kuddle) { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }
  let(:live)   { Fabricate(:booth_live, account: maker, started_at: 1.hour.ago, ended_at: 1.minute.ago) }

  def recording_of(kind, id = nil, status: 'ready')
    CallRecording.build_for(Kronk::CallTarget.find!(kind, id), filename: 'call.mp4', size: 100).tap do |recording|
      recording.status = status
      recording.save!
    end
  end

  permissions :show? do
    it 'shows a Kuddle’s to anyone signed in, and the Main Huddle’s', :aggregate_failures do
      expect(described_class).to permit(member, recording_of('kuddle', kuddle.id))
      expect(described_class).to permit(member, recording_of('huddle'))
      expect(described_class).to_not permit(nil, recording_of('huddle'))
    end

    it 'hides one still uploading' do
      expect(described_class).to_not permit(member, recording_of('huddle', status: 'pending'))
    end

    it 'shows a live set’s to its host and staff only', :aggregate_failures do
      recording = recording_of('booth_live', live.id)

      expect(described_class).to permit(maker, recording)
      expect(described_class).to permit(staff, recording)
      expect(described_class).to_not permit(member, recording)
    end
  end

  permissions :destroy? do
    it 'lets whoever moderates the call remove it', :aggregate_failures do
      expect(described_class).to permit(maker, recording_of('kuddle', kuddle.id))
      expect(described_class).to permit(staff, recording_of('kuddle', kuddle.id))
      expect(described_class).to_not permit(member, recording_of('kuddle', kuddle.id))
      expect(described_class).to permit(staff, recording_of('huddle'))
      expect(described_class).to_not permit(member, recording_of('huddle'))
      expect(described_class).to permit(maker, recording_of('booth_live', live.id))
    end
  end
end
