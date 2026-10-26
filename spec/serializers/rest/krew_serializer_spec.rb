# frozen_string_literal: true

require 'rails_helper'

RSpec.describe REST::KrewSerializer do
  subject { serialized_record_json(krew, described_class) }

  let(:krew) { Krew.create!(slug: 'covered', name: 'Covered', access: 'open') }

  it 'has no image url without a cover' do
    expect(subject['image_url']).to be_nil
  end

  # A Krew with a cover used to fail to serialize at all (full_asset_url was
  # undefined), which broke every Krew list it appeared in.
  it 'gives a full url for the cover' do
    krew.update!(image: Rails.root.join('spec', 'fixtures', 'files', '600x400.png').open)

    expect(subject['image_url']).to start_with('http').and include('krews/images')
  end

  describe 'viewer_role' do
    subject { serialized_record_json(krew, described_class, options: { scope: user, scope_name: :current_user }) }

    let(:user) { Fabricate(:user) }

    before { krew.update!(seeded_by_account_id: user.account_id) }

    it 'is seeder for the seeder while they are in it' do
      krew.krew_memberships.create!(account: user.account, role: 'seeder', source: 'direct')

      expect(subject['viewer_role']).to eq('seeder')
    end

    # The client reads any role as membership, so a seeder who left must
    # not still get member controls that the server then refuses.
    it 'is nil for the seeder once they have left' do
      expect(subject['viewer_role']).to be_nil
    end

    it 'is member for anyone else in it' do
      other = Fabricate(:user)
      krew.krew_memberships.create!(account: other.account, role: 'member', source: 'direct')

      expect(serialized_record_json(krew, described_class, options: { scope: other, scope_name: :current_user })['viewer_role']).to eq('member')
    end
  end

  # An "Attending an event" requirement names its event, but only to
  # someone who can see that event.
  describe 'requirements' do
    subject { serialized_record_json(gated, described_class, options: { scope: viewer, scope_name: :current_user }) }

    let(:host) { Fabricate(:user) }
    let(:gated) { Krew.create!(slug: 'gated', name: 'Gated', access: 'requirement_gated') }
    let(:event) do
      Event.create!(account: host.account, title: 'Secret supper', start_time: 2.days.from_now, end_time: 2.days.from_now + 2.hours, invite_only: true)
    end

    before { gated.krew_requirements.create!(kind: 'attending_event', event: event) }

    context 'when the viewer can see the event' do
      let(:viewer) { host }

      it 'carries its title and start' do
        req = subject['requirements'].first

        expect(req['event_id']).to eq(event.id.to_s)
        expect(req['event']).to include('title' => 'Secret supper', 'starts_at' => event.start_time.iso8601)
      end
    end

    context 'when the viewer cannot see the event' do
      let(:viewer) { Fabricate(:user) }

      it 'leaves the event out' do
        expect(subject['requirements'].first).to_not have_key('event')
      end
    end
  end
end
