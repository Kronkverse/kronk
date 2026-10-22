# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerContentStreams do
  let(:viewer) { Fabricate(:account) }

  describe '.for' do
    it 'returns the default status-backed stream for an ordinary korner' do
      expect(described_class.for('kommons')).to be_a(described_class::SourceKornerStream)
    end

    it 'returns the Kalendar override for the kalendar slug' do
      expect(described_class.for('kalendar')).to be_a(described_class::KalendarStream)
    end

    it 'returns the Moments override for the moments slug' do
      expect(described_class.for('moments')).to be_a(described_class::MomentStream)
    end

    it 'returns the Kommunity override for the kommunity slug' do
      expect(described_class.for('kommunity')).to be_a(described_class::KommunityStream)
    end

    it 'accepts a symbol slug' do
      expect(described_class.for(:kommons)).to be_a(described_class::SourceKornerStream)
    end
  end

  describe described_class::SourceKornerStream do
    subject { described_class.new('kommons') }

    it 'scopes to the korner, excludes replies, and excludes the viewer own posts' do
      sql = subject.unread_relation(viewer, 0, []).to_sql
      expect(sql).to include(%q("statuses"."source_korner" = 'kommons'))
      expect(sql).to include('reply')
      expect(sql).to include(%("statuses"."account_id" != #{viewer.id}))
    end

    it 'reports the newest korner status id, 0 when empty' do
      expect(subject.newest_id(viewer)).to eq(0)
      poster = Fabricate(:account)
      viewer.follow!(poster)
      status = Fabricate(:status, account: poster, source_korner: 'kommons')
      expect(subject.newest_id(viewer)).to eq(status.id)
    end
  end

  describe 'what counts as an update' do
    let(:viewer) { Fabricate(:account, created_at: 1.day.ago) }
    let(:poster) { Fabricate(:account) }

    before { viewer.follow!(poster) }

    def unread(slug)
      stream = described_class.for(slug)
      stream.unread_relation(viewer, stream.starting_baseline(viewer), []).to_a
    end

    it 'never counts a hidden post, so a photo added to an album is not an update' do
      album_card = Fabricate(:status, account: poster, source_korner: 'albutts')
      Fabricate(:status, account: poster, source_korner: 'albutts', post_type: :album_photo)

      expect(unread('albutts')).to contain_exactly(album_card)
    end

    it 'counts a Kalendar event until it is over, and never a cancelled one' do
      event_post = lambda do |**attrs|
        status = Fabricate(:status, account: poster, source_korner: 'kalendar')
        Event.create!(account: poster, title: 'Picnic', status: status, start_time: 1.day.from_now, **attrs)
        status
      end

      upcoming = event_post.call
      happening = event_post.call(start_time: 1.hour.ago, end_time: 1.hour.from_now)
      event_post.call(start_time: 2.days.ago, end_time: 1.day.ago)
      event_post.call(start_time: 2.days.ago)
      event_post.call(cancelled: true)

      expect(unread('kalendar')).to contain_exactly(upcoming, happening)
    end

    it 'starts a korner never opened from when the viewer joined' do
      Fabricate(:status, account: poster, source_korner: 'kommons', id: Mastodon::Snowflake.id_at(viewer.created_at - 1.hour))
      newer = Fabricate(:status, account: poster, source_korner: 'kommons')

      expect(unread('kommons')).to contain_exactly(newer)
    end
  end

  describe described_class::MomentStream do
    subject { described_class.new }

    it 'streams live moments, keyed on moment id, excluding the viewer own' do
      sql = subject.unread_relation(viewer, 0, []).to_sql
      expect(sql).to include('moments')
      expect(sql).to include(%("moments"."account_id" != #{viewer.id}))
    end

    it 'reports 0 newest id when there are no moments' do
      expect(subject.newest_id(viewer)).to eq(0)
    end
  end

  describe described_class::KommunityStream do
    subject(:stream) { described_class.new }

    let(:viewer) { Fabricate(:account, created_at: 1.day.ago) }

    def member(discoverability)
      Fabricate(:account, kommunity_discoverability: discoverability).tap do |account|
        account.user.update!(current_sign_in_at: 1.minute.ago)
      end
    end

    def unread
      stream.unread_relation(viewer, stream.starting_baseline(viewer), []).to_a
    end

    it 'counts someone new the viewer could find in Kommunity' do
      newcomer = member(:everyone)

      expect(unread).to contain_exactly(newcomer)
    end

    it 'leaves out people who keep themselves out of reach' do
      member(:nobody)
      member(:orbit)

      expect(unread).to be_empty
    end

    it 'stops counting once the viewer has looked' do
      member(:everyone)

      expect(stream.unread_relation(viewer, stream.newest_id(viewer), [])).to be_empty
    end
  end
end
