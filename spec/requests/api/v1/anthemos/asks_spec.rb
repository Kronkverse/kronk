# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Asks from Kronk to Anthemos' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:headers) { bearer(user) }
  let(:ana)     { Fabricate(:account, username: 'ana') }
  let(:key)     { OpenSSL::PKey::EC.generate('prime256v1') }
  let(:public_key) { Base64.strict_encode64(key.public_to_der) }
  let!(:link) { AnthemosLink.create!(account: me, device_name: 'Pixel 8', public_key: public_key) }

  def bearer(owner)
    { 'Authorization' => "Bearer #{Fabricate(:accessible_access_token, resource_owner_id: owner.id, scopes: 'read write').token}" }
  end

  def sign(*parts, with: key)
    Base64.strict_encode64(with.sign('SHA256', parts.map(&:to_s).join("\n")))
  end

  def ask!(kind, payload = {})
    post '/api/v1/anthemos/asks', headers: headers, params: { kind: kind, payload: payload }
    response.parsed_body
  end

  def answer!(token, outcome, result = '', as: headers, link_id: link.id, signature: nil)
    post "/api/v1/anthemos/asks/#{token}/answer",
         headers: as,
         params: { link_id: link_id, outcome: outcome, result: result,
                   signature: signature || sign('anthemos-answer-v1', token, link_id, outcome, result) }
  end

  before do
    me.follow!(ana)
    ana.follow!(me)
  end

  describe 'asking' do
    it 'makes an ask for this account that waits a few minutes' do
      body = ask!('location.update')

      expect(response).to have_http_status(200)
      expect(body[:status]).to eq('waiting')
      expect(body[:account][:acct]).to eq(me.acct)
      expect(Time.zone.parse(body[:expires_at])).to be_within(1.minute).of(5.minutes.from_now)
    end

    it 'names the Mate a share is for' do
      body = ask!('location.share', { to: ana.id.to_s })

      expect(body[:to][:acct]).to eq('ana')
    end

    it 'refuses a share with someone who is not a Mate' do
      stranger = Fabricate(:account)
      ask!('location.share', { to: stranger.id.to_s })

      expect(response).to have_http_status(422)
    end

    it 'refuses a kind Anthemos does not do' do
      ask!('camera.open')

      expect(response).to have_http_status(422)
    end

    it 'needs a linked phone' do
      link.destroy!
      ask!('location.update')

      expect(response).to have_http_status(422)
      expect(response.parsed_body[:error]).to eq('no_phone')
    end

    it 'keeps only what the kind carries' do
      ask!('location.update', { to: ana.id.to_s })

      expect(AnthemosAsk.last.payload).to eq({})
    end
  end

  describe 'another account' do
    let(:other) { Fabricate(:user) }

    it 'cannot read an ask made in this one' do
      token = ask!('location.update')[:id]
      get "/api/v1/anthemos/asks/#{token}", headers: bearer(other)

      expect(response).to have_http_status(404)
    end

    it 'cannot answer it, even with this phone signing' do
      token = ask!('location.update')[:id]
      answer!(token, 'done', as: bearer(other))

      expect(response).to have_http_status(404)
      expect(AnthemosAsk.last.state).to eq('waiting')
    end
  end

  describe 'answering' do
    it 'takes a signed answer once, and shows it to the website' do
      token = ask!('location.update')[:id]
      answer!(token, 'done', 'Sydney, Australia')
      expect(response).to have_http_status(200)

      get "/api/v1/anthemos/asks/#{token}", headers: headers
      expect(response.parsed_body).to include(status: 'done', result: 'Sydney, Australia')

      answer!(token, 'declined')
      expect(response).to have_http_status(410)
    end

    it 'refuses an answer not signed by the linked phone' do
      token = ask!('location.update')[:id]
      answer!(token, 'done', signature: sign('anthemos-answer-v1', token, link.id, 'done', '', with: OpenSSL::PKey::EC.generate('prime256v1')))

      expect(response).to have_http_status(422)
      expect(AnthemosAsk.last.state).to eq('waiting')
    end

    it 'refuses a signature over a different outcome' do
      token = ask!('location.update')[:id]
      answer!(token, 'done', signature: sign('anthemos-answer-v1', token, link.id, 'declined', ''))

      expect(response).to have_http_status(422)
    end

    it 'refuses an answer after the ask runs out' do
      token = ask!('location.update')[:id]
      travel 6.minutes do
        get "/api/v1/anthemos/asks/#{token}", headers: headers
        expect(response.parsed_body[:status]).to eq('expired')

        answer!(token, 'done')
        expect(response).to have_http_status(410)
      end
    end
  end
end
