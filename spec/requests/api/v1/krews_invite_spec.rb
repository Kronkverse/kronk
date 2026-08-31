# frozen_string_literal: true

require 'rails_helper'

# Krew invites (create-time People section): each selected local account gets a
# directed krew_invite nudge — they choose to join (no forced membership). The
# directed flag lets the nudge reach non-Mates, which is the point of inviting.
RSpec.describe 'API V1 Krews create — invites' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let!(:invitee) { Fabricate(:user, account_attributes: { username: 'invited' }).account }

  def create_krew(extra = {})
    post '/api/v1/krews', headers: headers, params: {
      name: 'Snowgum Skip',
      slug: 'snowgum-skip',
      access: 'invite_only',
    }.merge(extra)
  end

  it 'sends a krew_invite nudge to each invited local account (incl. non-Mates)' do
    expect { create_krew(invite_account_ids: [invitee.id]) }
      .to change { Nudges::Event.where(verb: 'krew_invite', source_type: 'Krew').count }.by(1)

    expect(response).to have_http_status(200)
  end

  it 'never invites the seeder themselves' do
    expect { create_krew(invite_account_ids: [user.account.id]) }
      .to_not(change { Nudges::Event.where(verb: 'krew_invite').count })
  end

  it 'sends no invites when none are given' do
    expect { create_krew }.to_not(change { Nudges::Event.where(verb: 'krew_invite').count })
    expect(response).to have_http_status(200)
  end
end
