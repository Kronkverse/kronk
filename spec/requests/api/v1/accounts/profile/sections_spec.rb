# frozen_string_literal: true

require 'rails_helper'

# Nails down that a profile shelf's status list obeys per-post
# visibility. Regression coverage for the leak found in the
# 2026-08-01 audit — the endpoint used to render every status the
# shelf query matched, ignoring `direct` / `private` / krew scoping.
RSpec.describe 'Accounts Profile Sections API' do
  let(:owner) { Fabricate(:account) }
  let(:viewer_user) { Fabricate(:user) }
  let(:viewer)  { viewer_user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: viewer_user.id, scopes: 'read:accounts read:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let!(:public_status) { Fabricate(:status, account: owner, visibility: :public) }
  let!(:direct_status) { Fabricate(:status, account: owner, visibility: :direct) }

  # A shelf on the owner's profile holding both statuses — the simplest
  # shape that exercises the visibility gate, which is all this spec is
  # about.
  #
  # It used to say "kind + settings don't matter beyond 'this returns
  # account.statuses'" and fabricate a `timeline` shelf. That stopped
  # being true: a drawn shelf resolves its statuses through
  # `drawn_base_scope`, which returns `Status.none` unless the shelf is
  # bound to a korner or a kategory. A `chosen` shelf is the one shape
  # that returns the account's own statuses directly
  # (`@account.statuses.where(id: order_ids)`), so it keeps the spec
  # aimed at visibility rather than at shelf bindings. Declared after
  # the statuses because it names their ids.
  let!(:section) do
    Fabricate(
      :profile_section,
      account: owner,
      position: 0,
      settings: {
        'render' => 'album',
        'order' => 'chosen',
        'order_ids' => [public_status.id.to_s, direct_status.id.to_s],
      }
    )
  end

  describe 'GET /api/v1/accounts/:account_id/profile/sections/:id/statuses' do
    context 'when the viewer is NOT the owner and NOT a mention of the direct status' do
      it 'returns only the public status' do
        get "/api/v1/accounts/#{owner.id}/profile/sections/#{section.id}/statuses", headers: headers

        expect(response).to have_http_status(200)
        ids = response.parsed_body.pluck('id')
        expect(ids).to include(public_status.id.to_s)
        expect(ids).to_not include(direct_status.id.to_s)
      end
    end

    context 'when the viewer IS the owner' do
      let(:viewer_user) { Fabricate(:user, account: owner) }

      it 'returns both statuses (owner sees own private posts)' do
        get "/api/v1/accounts/#{owner.id}/profile/sections/#{section.id}/statuses", headers: headers

        expect(response).to have_http_status(200)
        ids = response.parsed_body.pluck('id')
        expect(ids).to include(public_status.id.to_s, direct_status.id.to_s)
      end
    end
  end

  # `candidates=1` is what the post picker asks for: everything the shelf
  # COULD show, so an owner curating a `chosen` shelf can add to it rather
  # than only ever take posts off it.
  describe 'GET …/statuses?candidates=1' do
    let(:tag) { Fabricate(:tag, name: 'treks') }

    let!(:unchosen_status) { Fabricate(:status, account: owner, visibility: :public) }

    let!(:kategory_section) do
      Fabricate(
        :profile_section,
        account: owner,
        position: 1,
        settings: {
          'render' => 'chips',
          'tag_name' => 'treks',
          'order' => 'chosen',
          'order_ids' => [public_status.id.to_s],
        }
      )
    end

    before do
      public_status.tags << tag
      unchosen_status.tags << tag
    end

    context 'when the viewer IS the owner' do
      let(:viewer_user) { Fabricate(:user, account: owner) }

      it 'returns the whole korner, not just the chosen posts' do
        get "/api/v1/accounts/#{owner.id}/profile/sections/#{kategory_section.id}/statuses", params: { candidates: '1' }, headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck('id')).to include(public_status.id.to_s, unchosen_status.id.to_s)
      end

      it 'still returns only the chosen posts without the param' do
        get "/api/v1/accounts/#{owner.id}/profile/sections/#{kategory_section.id}/statuses", headers: headers

        expect(response).to have_http_status(200)
        ids = response.parsed_body.pluck('id')
        expect(ids).to include(public_status.id.to_s)
        expect(ids).to_not include(unchosen_status.id.to_s)
      end
    end

    context 'when the viewer is NOT the owner' do
      it 'ignores the param and answers as the shelf reads' do
        get "/api/v1/accounts/#{owner.id}/profile/sections/#{kategory_section.id}/statuses", params: { candidates: '1' }, headers: headers

        expect(response).to have_http_status(200)
        ids = response.parsed_body.pluck('id')
        expect(ids).to include(public_status.id.to_s)
        expect(ids).to_not include(unchosen_status.id.to_s)
      end
    end
  end
end
