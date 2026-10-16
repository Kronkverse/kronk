# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/profile.md, Who can see a profile: the owner sees their profile
# as each circle would.
RSpec.describe 'Profile, seen as others see it' do
  let(:owner)   { Fabricate(:user).account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: owner.user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  before do
    %w(public orbit mates self_only).each_with_index do |reach, position|
      Fabricate(:profile_section, account: owner, position: position, visibility: reach, title: reach)
    end

    Kuestions::ProfileSeeds.sync!
    { 'think_about' => 'public', 'art' => 'mates' }.each_with_index do |(key, reach), position|
      Answer.create!(account: owner, question: Question.find_by!(seed_key: key), body: 'Clay, rivers, tea',
                     pinned_at: Time.current, pin_position: position, visibility_scope: reach)
    end
  end

  def shelves(as: nil)
    get "/api/v1/accounts/#{owner.id}/profile/sections", params: { as: as }.compact, headers: headers
    response.parsed_body.pluck(:title)
  end

  def pins(as: nil)
    get '/api/v2/kuestions/pinned', params: { account_id: owner.id, as: as }.compact, headers: headers
    response.parsed_body.pluck(:seed_key)
  end

  it 'shows each circle only what reaches it' do
    expect(shelves(as: 'kronkverse')).to eq %w(public)
    expect(shelves(as: 'orbit')).to eq %w(public orbit)
    expect(shelves(as: 'mates')).to eq %w(public orbit mates)

    expect(pins(as: 'kronkverse')).to eq %w(think_about)
    expect(pins(as: 'mates')).to eq %w(think_about art)
  end

  it 'shows nothing past the name to a circle the profile itself does not reach' do
    owner.update!(profile_visibility: 'mates')

    expect(shelves(as: 'kronkverse')).to be_empty
    expect(pins(as: 'kronkverse')).to be_empty
    expect(shelves(as: 'mates')).to eq %w(public orbit mates)
  end

  it 'ignores `as` from anyone but the owner' do
    other   = Fabricate(:user)
    o_token = Fabricate(:accessible_access_token, resource_owner_id: other.id, scopes: 'read')

    get "/api/v1/accounts/#{owner.id}/profile/sections", params: { as: 'mates' }, headers: { 'Authorization' => "Bearer #{o_token.token}" }

    expect(response.parsed_body.pluck(:title)).to eq %w(public)
  end
end
