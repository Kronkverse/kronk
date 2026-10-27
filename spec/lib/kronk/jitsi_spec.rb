# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-10-27, "Kronk's own Jitsi".
RSpec.describe Kronk::Jitsi do
  let(:account) { Fabricate(:account, username: 'rosa', display_name: 'Rosa') }

  describe '.room_name and .room_key' do
    it 'uses the stored key as it is with no prefix' do
      expect(described_class.room_name('huddle')).to eq 'huddle'
      expect(described_class.room_key('huddle')).to eq 'huddle'
    end

    context 'with a prefix' do
      before { allow(described_class).to receive(:room_prefix).and_return('shadow-') }

      it 'puts it before every name and takes it off again', :aggregate_failures do
        expect(described_class.room_name('ember-1a2b3c4d')).to eq 'shadow-ember-1a2b3c4d'
        expect(described_class.room_key('shadow-ember-1a2b3c4d')).to eq 'ember-1a2b3c4d'
        expect(described_class.room_key('Shadow-Huddle@conference.meet.jitsi')).to eq 'huddle'
      end

      it 'says a name without it is not one of this Kronk’s' do
        expect(described_class.room_key('huddle')).to be_nil
      end
    end
  end

  describe '.pass' do
    it 'is nil without a secret' do
      allow(described_class).to receive(:jwt_secret).and_return(nil)

      expect(described_class.pass(account: account, room: 'huddle', moderator: false)).to be_nil
    end

    it 'signs the claims the server checks', :aggregate_failures do
      allow(described_class).to receive(:jwt_secret).and_return('s3cret')
      now = Time.zone.parse('2026-10-27 12:00:00')

      token = described_class.pass(account: account, room: 'huddle', moderator: true, avatar: 'https://example.com/a.png', now: now)
      claims, header = JWT.decode(token, 's3cret', true, algorithm: 'HS256', verify_expiration: false, verify_not_before: false)

      expect(header['alg']).to eq 'HS256'
      expect(claims).to include(
        'iss' => 'kronk', 'aud' => 'jitsi', 'sub' => 'meet.jitsi', 'room' => 'huddle',
        'iat' => now.to_i, 'nbf' => now.to_i - 60, 'exp' => (now + 2.hours).to_i
      )
      expect(claims.dig('context', 'user')).to eq(
        'id' => account.id.to_s, 'name' => 'Rosa', 'avatar' => 'https://example.com/a.png',
        'moderator' => true, 'affiliation' => 'owner'
      )
    end
  end
end
