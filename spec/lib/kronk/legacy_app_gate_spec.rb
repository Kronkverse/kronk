# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::LegacyAppGate do
  subject(:response) { described_class.new(inner).call(env) }

  let(:inner) { ->(_env) { [200, {}, ['passed through']] } }
  let(:env) do
    {
      'PATH_INFO' => path,
      'HTTP_USER_AGENT' => user_agent,
    }
  end
  let(:path) { '/api/v1/timelines/home' }
  let(:user_agent) { 'MastodonAndroid/2.5.1' }

  before { allow(Kronk::FeatureFlags).to receive(:enabled?).with(:legacy_app_gate).and_return(flag) }

  context 'when the flag is on' do
    let(:flag) { true }

    it 'answers an Android client with the move-to-the-web message' do
      status, headers, body = response

      expect(status).to eq 410
      expect(headers['X-Kronk-Legacy-Client']).to eq 'gated'
      expect(body.first).to include('moved to the web')
    end

    it 'leaves a browser alone' do
      env['HTTP_USER_AGENT'] = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/141.0'

      expect(response.first).to eq 200
    end

    it 'leaves a request with no user agent alone' do
      env.delete('HTTP_USER_AGENT')

      expect(response.first).to eq 200
    end

    # The contract for the replacement app: identify as Kronk and the gate
    # ignores you. It needs saying in tests because the 2.0 client is a
    # fresh rewrite of a Mastodon client, and the thing it forked from
    # sends "MastodonAndroid/" — keep that string and the server would turn
    # away the very app this gate exists to make room for.
    context 'when the client identifies itself as Kronk' do
      it 'is not gated' do
        env['HTTP_USER_AGENT'] = 'KronkAndroid/1.0.0'

        expect(response.first).to eq 200
      end

      it 'is not gated when the forked-from name is also present' do
        env['HTTP_USER_AGENT'] = 'KronkAndroid/1.0.0 (MastodonAndroid/2.12.0)'

        expect(response.first).to eq 200
      end

      it 'matches case-insensitively, so casing is not a trap' do
        env['HTTP_USER_AGENT'] = 'kronk-app/1.0.0'

        expect(response.first).to eq 200
      end

      it 'does not let a client merely mentioning Kronk later through' do
        env['HTTP_USER_AGENT'] = 'MastodonAndroid/2.12.0 (Kronk)'

        expect(response.first).to eq 410
      end
    end

    # The gate exists to make room for a replacement, so it must not shut
    # the door on one: the new app will send the same user agent.
    context 'with LEGACY_APP_MIN_VERSION set' do
      around do |example|
        ClimateControl.modify(LEGACY_APP_MIN_VERSION: '3.0.0') { example.run }
      end

      it 'lets a new-enough client through' do
        env['HTTP_USER_AGENT'] = 'MastodonAndroid/3.0.0'

        expect(response.first).to eq 200
      end

      it 'still gates an older one' do
        env['HTTP_USER_AGENT'] = 'MastodonAndroid/2.9.9'

        expect(response.first).to eq 410
      end
    end

    # Web pages, deep links and the OAuth dance are none of this middleware's
    # business — a tapped link should still open something useful.
    it 'only touches /api' do
      env['PATH_INFO'] = '/@tal/123'

      expect(response.first).to eq 200
    end

    it 'leaves /oauth alone' do
      env['PATH_INFO'] = '/oauth/token'

      expect(response.first).to eq 200
    end
  end

  context 'when the flag is off' do
    let(:flag) { false }

    it 'passes everything through' do
      expect(response.first).to eq 200
    end
  end
end
