# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::NotificationSubjects do
  let(:ana) { Fabricate(:account) }
  let(:bob) { Fabricate(:account) }

  it 'reads a markdown link in a post as its text' do
    status = Fabricate(:status, account: ana, text: 'Come to [the garden day](https://example.com/garden) on Sunday')
    event = Fabricate(:nudges_event, conversation: nil, actor_account: ana, recipient_account: bob, source_korner_slug: 'feed',
                                     verb: 'mentioned', source_type: 'Status', source_id: status.id)

    expect(described_class.new([event], viewer: bob).title_for(event)).to eq('Come to the garden day on Sunday')
  end
end
