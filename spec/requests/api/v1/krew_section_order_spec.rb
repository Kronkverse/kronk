# frozen_string_literal: true

require 'rails_helper'

# A Krew's members arrange the order its sections run down its page
# (docs/spaces/krew.md, Arranging the page).
RSpec.describe 'API V1 Krew section order' do
  let(:member)   { Fabricate(:user) }
  let(:outsider) { Fabricate(:user) }

  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: member.account,
                 last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: member.account, role: 'seeder', source: 'direct')
    end
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  it 'saves the order a member gives, dropping unknown and repeated keys' do
    patch "/api/v1/krews/#{krew.slug}", headers: headers_for(member),
                                        params: { section_order: %w(kalendar projekts nonsense albutts kalendar) }

    expect(response).to have_http_status(200)
    expect(response.parsed_body['section_order']).to eq %w(kalendar projekts albutts)
    expect(krew.reload.section_order).to eq %w(kalendar projekts albutts)
  end

  it 'refuses someone outside the Krew' do
    patch "/api/v1/krews/#{krew.slug}", headers: headers_for(outsider), params: { section_order: %w(projekts) }

    expect(response).to have_http_status(403)
    expect(krew.reload.section_order).to eq []
  end
end
