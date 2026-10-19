# frozen_string_literal: true

require 'rails_helper'

# An album photo is a post only so it can carry a caption, froths and replies;
# the album is where it shows. It stays off Kronkverse on Home (the public
# timeline), hashtag timelines and its contributor's profile, and a caption
# edit doesn't fan it out (docs/spaces/albutts.md, Feed).
RSpec.describe 'Album photos stay in their album' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:ash)     { Fabricate(:account) }
  let(:album)   { Album.create!(owner: ash, title: 'Mayhem', visibility: :public) }
  let!(:photo_post) do
    media = Fabricate(:media_attachment, account: ash)
    Albutts::PublishPhoto.new(album: album, contributor: ash, media_attachment: media, caption: 'Night one #mayhem').call
  end
  let!(:normal_post) { Fabricate(:status, account: ash, text: 'Hello #mayhem', visibility: :public) }

  it 'leaves them off Kronkverse on Home' do
    get '/api/v1/timelines/public', params: { local: true }, headers: headers

    ids = response.parsed_body.pluck('id')
    expect(ids).to include(normal_post.id.to_s)
    expect(ids).to_not include(photo_post.id.to_s)
  end

  it 'leaves them off a hashtag' do
    get '/api/v1/timelines/tag/mayhem', headers: headers

    expect(response.parsed_body.pluck('id')).to_not include(photo_post.id.to_s)
  end

  it "leaves them off their contributor's profile" do
    get "/api/v1/accounts/#{ash.id}/statuses", headers: headers

    ids = response.parsed_body.pluck('id')
    expect(ids).to include(normal_post.id.to_s)
    expect(ids).to_not include(photo_post.id.to_s)
  end

  it "doesn't fan a photo out when its caption is edited" do
    allow(DistributionWorker).to receive(:perform_async)

    UpdateStatusService.new.call(photo_post, ash.id, text: 'Night one, edited')

    expect(DistributionWorker).to_not have_received(:perform_async)
  end
end
