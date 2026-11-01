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

  # Once recorded, kept: nobody deletes one (Tal, 2026-10-29).
  it 'has no way to remove one' do
    expect(described_class.new(staff, recording_of('huddle'))).to_not respond_to(:destroy?)
  end
end
