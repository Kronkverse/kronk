# frozen_string_literal: true

require 'rails_helper'

# Low-severity privacy fixes from the 2026-10-15 audit.
RSpec.describe 'Blocks and hidden Mates in the small places' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def mate!(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  it 'ends shared cycle phase both ways when either blocks the other', :inline_jobs do
    PhaseShare.grant!(sharer: alice.account, viewer: bob.account)
    PhaseShare.grant!(sharer: bob.account, viewer: alice.account)

    BlockService.new.call(alice.account, bob.account)

    expect(PhaseShare.where(sharer: [alice.account, bob.account])).to_not exist
  end

  it 'shows no Mates in common with someone who hides their Mates' do
    carol = Fabricate(:account)
    mate!(alice.account, carol)
    mate!(bob.account, carol)
    bob.account.update!(hide_collections: true)

    get "/api/v1/accounts/#{bob.account.id}/matuals", headers: headers_for(alice)

    expect(response.parsed_body['count']).to eq 0
  end
end
