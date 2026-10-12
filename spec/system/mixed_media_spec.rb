# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/feed.md: Media on a post. Photos and videos in one post.
RSpec.describe 'A post with photos and a video', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    # The test server does not serve the fixture files themselves.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'shows them together in the gallery, the video as a tile of its own' do
    photo = Fabricate(:media_attachment, account: bob.account, type: :image)
    video = Fabricate(:media_attachment, account: bob.account, type: :image)
    video.update!(type: :video)

    status = PostStatusService.new.call(bob.account, text: 'Dawn patrol', media_ids: [photo.id.to_s, video.id.to_s])

    visit "/@#{bob.account.username}/#{status.id}"

    expect(page).to have_content('Dawn patrol')
    expect(page).to have_css('.media-gallery__item', count: 2)
    expect(page).to have_css('.media-gallery__item video', count: 1)
  end
end
