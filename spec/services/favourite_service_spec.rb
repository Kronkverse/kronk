# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FavouriteService do
  subject { described_class.new }

  let(:sender) { Fabricate(:account, username: 'alice') }

  describe 'local' do
    let(:bob)    { Fabricate(:account) }
    let(:status) { Fabricate(:status, account: bob) }

    it 'creates a favourite' do
      subject.call(sender, status)

      expect(status.favourites.first).to_not be_nil
    end

    it 'marks a korner-tagged status seen for the sender' do
      korner_status = Fabricate(:status, account: bob, source_korner: 'kommons')

      subject.call(sender, korner_status)

      expect(KornerContentView.where(account: sender, korner_slug: 'kommons', content_id: korner_status.id)).to exist
    end

    it 'does not create a seen row for a non-korner status' do
      expect { subject.call(sender, status) }.to_not change(KornerContentView, :count)
    end
  end

  describe 'remote ActivityPub' do
    let(:bob)    { Fabricate(:account, protocol: :activitypub, username: 'bob', domain: 'example.com', inbox_url: 'http://example.com/inbox') }
    let(:status) { Fabricate(:status, account: bob) }

    before do
      stub_request(:post, 'http://example.com/inbox').to_return(status: 200, body: '', headers: {})
    end

    it 'creates a favourite and sends like activity', :inline_jobs do
      subject.call(sender, status)

      expect(status.favourites.first)
        .to_not be_nil

      expect(a_request(:post, 'http://example.com/inbox'))
        .to have_been_made.once
    end
  end
end
