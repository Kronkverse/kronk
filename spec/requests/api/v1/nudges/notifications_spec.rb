# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Nudges notifications' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:scopes)  { 'read:notifications write:notifications' }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:ana)     { Fabricate(:account) }
  let(:ben)     { Fabricate(:account) }

  def notify(actor:, recipient: me, **attrs)
    Fabricate(
      :nudges_event,
      conversation: nil,
      actor_account: actor,
      recipient_account: recipient,
      **attrs
    )
  end

  describe 'GET /api/v1/nudges/notifications' do
    it 'lists what is addressed to me across chats, newest first' do
      notify(actor: ana, verb: 'backed', interaction: 'interactive', created_at: 2.hours.ago)
      notify(actor: ben, verb: 'mate_requested', created_at: 1.hour.ago)

      get '/api/v1/nudges/notifications', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:notifications].pluck(:verb)).to eq(%w(mate_requested backed))
      expect(response.parsed_body[:unseen_count]).to eq(2)
      expect(response.parsed_body[:next_before]).to be_nil
      expect(Time.iso8601(response.parsed_body[:as_of])).to be_within(1.minute).of(Time.current)
    end

    it 'leaves out what I did, and lines that belong to a chat' do
      notify(actor: me, recipient: ana, verb: 'frothed')
      Fabricate(:nudges_event, conversation: Nudges::Conversation.mate_between!(me, ana), actor_account: ana, verb: 'milestone_250')

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications]).to be_empty
      expect(response.parsed_body[:unseen_count]).to eq(0)
    end

    it 'rolls passive events about one thing up across people' do
      notify(actor: ana, verb: 'frothed', source_type: 'Status', source_id: 7, created_at: 2.hours.ago)
      notify(actor: ben, verb: 'frothed', source_type: 'Status', source_id: 7, created_at: 1.hour.ago)
      notify(actor: ana, verb: 'frothed', source_type: 'Status', source_id: 8, created_at: 3.hours.ago)

      get '/api/v1/nudges/notifications', headers: headers

      rows = response.parsed_body[:notifications]
      expect(rows.size).to eq(2)
      expect(rows.first).to include(source_id: '7', count: 2, seen: false)
      expect(rows.first[:actors].pluck(:id)).to eq([ben.id.to_s, ana.id.to_s])
      expect(rows.last).to include(source_id: '8', count: 1)
    end

    it 'says what each one is about and where a tap goes' do
      proposal = Fabricate(:proposal, title: 'Community garden', created_by_account: me)
      notify(actor: ana, source_korner_slug: 'kommons', verb: 'frothed', source_type: 'Proposal', source_id: proposal.id)

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications].first)
        .to include(subject: 'Community garden', route: "/hub/kommons/p/#{proposal.id}")
    end

    it "uses the event's own link when it has one" do
      notify(actor: ana, verb: 'backed', interaction: 'interactive', cta_label: 'View proposal', cta_route: '/hub/kommons/p/9')

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications].first[:route]).to eq('/hub/kommons/p/9')
    end

    it 'quotes a post I can see' do
      status = Fabricate(:status, account: me, text: 'Swell is up at the point')
      notify(actor: ana, source_korner_slug: 'feed', verb: 'frothed', source_type: 'Status', source_id: status.id)

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications].first)
        .to include(subject: 'Swell is up at the point', route: "/statuses/#{status.id}")
    end

    it 'does not quote a post that is not mine to see, and sends me to the person' do
      hidden = Fabricate(:status, account: ana, visibility: :direct, text: 'not for you')
      notify(actor: ana, source_korner_slug: 'feed', verb: 'mentioned', source_type: 'Status', source_id: hidden.id)

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications].first)
        .to include(subject: nil, route: "/@#{ana.acct}")
    end

    it 'still lists one whose source has been deleted' do
      notify(actor: ana, source_korner_slug: 'kommons', verb: 'frothed', source_type: 'Proposal', source_id: 0)

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications].first)
        .to include(subject: nil, route: "/@#{ana.acct}")
    end

    it 'keeps interactive events apart' do
      2.times { notify(actor: ana, verb: 'replied', interaction: 'interactive', source_type: 'Status', source_id: 7) }

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications].size).to eq(2)
    end

    it 'pages back with the cursor it returns' do
      notify(actor: ana, verb: 'backed', interaction: 'interactive', created_at: 3.hours.ago)
      notify(actor: ana, verb: 'claimed', interaction: 'interactive', created_at: 2.hours.ago)
      notify(actor: ana, verb: 'answered', interaction: 'interactive', created_at: 1.hour.ago)

      get '/api/v1/nudges/notifications', params: { limit: 2 }, headers: headers
      expect(response.parsed_body[:notifications].pluck(:verb)).to eq(%w(answered claimed))

      get '/api/v1/nudges/notifications', params: { limit: 2, before: response.parsed_body[:next_before] }, headers: headers
      expect(response.parsed_body[:notifications].pluck(:verb)).to eq(%w(backed))
      expect(response.parsed_body[:next_before]).to be_nil
    end

    it 'hides a suspended actor' do
      notify(actor: ana, verb: 'frothed')
      ana.suspend!

      get '/api/v1/nudges/notifications', headers: headers

      expect(response.parsed_body[:notifications]).to be_empty
    end

    it 'rejects a cursor that is not a time' do
      get '/api/v1/nudges/notifications', params: { before: 'yesterday' }, headers: headers

      expect(response).to have_http_status(400)
    end

    context 'without the read scope' do
      let(:scopes) { 'write:notifications' }

      it 'is forbidden' do
        get '/api/v1/nudges/notifications', headers: headers

        expect(response).to have_http_status(403)
      end
    end
  end

  describe 'GET /api/v1/nudges/notifications/unseen_count' do
    it 'counts only what I have not seen' do
      notify(actor: ana, verb: 'frothed')
      notify(actor: ben, verb: 'frothed', seen_at: 1.minute.ago)

      get '/api/v1/nudges/notifications/unseen_count', headers: headers

      expect(response.parsed_body[:unseen_count]).to eq(1)
    end
  end

  describe 'POST /api/v1/nudges/notifications/seen' do
    it 'marks everything seen' do
      notify(actor: ana, verb: 'frothed')

      post '/api/v1/nudges/notifications/seen', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:unseen_count]).to eq(0)
    end

    it 'leaves alone what arrived after the list was loaded' do
      old   = notify(actor: ana, verb: 'frothed', created_at: 10.minutes.ago)
      fresh = notify(actor: ben, verb: 'frothed', created_at: 1.minute.ago)

      post '/api/v1/nudges/notifications/seen', params: { up_to: 5.minutes.ago.iso8601 }, headers: headers

      expect(old.reload.seen_at).to be_present
      expect(fresh.reload.seen_at).to be_nil
      expect(response.parsed_body[:unseen_count]).to eq(1)
    end

    it "does not touch someone else's" do
      theirs = notify(actor: me, recipient: ana, verb: 'frothed')

      post '/api/v1/nudges/notifications/seen', headers: headers

      expect(theirs.reload.seen_at).to be_nil
    end
  end
end
