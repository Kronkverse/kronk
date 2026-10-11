# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md: the owner chooses the album's cover from its photos.
RSpec.describe 'Albutts', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:album) { Album.create!(owner: bob.account, title: 'Road trip', visibility: :public) }

  def add_photo
    media  = Fabricate(:media_attachment, account: bob.account)
    status = Fabricate(:status, account: bob.account, media_attachments: [media])
    AlbumPhoto.create!(album: album, contributor: bob.account, status: status)
    media
  end

  before do
    as_a_logged_in_user
    # Fabricated uploads have no resized files on disk for the browser to fetch.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'lets the owner make any photo the cover, from the Ж menu' do
    add_photo
    second = add_photo

    visit "/hub/albutts/albums/#{album.id}?photo=#{album.photos.last.id}"

    expect(page).to have_css('.albutts-lightbox__counter', text: '2 / 2')
    find('.kronk-menu__trigger').click
    click_on 'Use as album cover'

    expect(page).to have_content('Album cover updated')
    expect(album.reload.cover_media_attachment_id).to eq second.id
  end

  it 'downloads the whole album, or the photos you tick, from buttons on the page' do
    2.times { add_photo }

    visit "/hub/albutts/albums/#{album.id}"

    click_on 'Download album'
    expect(page).to have_content('Putting 2 photos into a zip')

    click_on 'Select photos'
    expect(page).to have_content('Tap photos to choose them')
    expect(page).to have_button('Download', disabled: true)

    first('.albutts-photo__trigger').click
    expect(page).to have_content('1 selected')
    click_on 'Download'
    expect(page).to have_content('Putting 1 photo into a zip')

    click_on 'Done'
    expect(page).to have_no_css('.albutts-select-bar')

    # The link is opened by the browser with its session, not with a token.
    status = page.evaluate_async_script(<<~JS)
      const done = arguments[0];
      fetch('/api/v1/albutts/albums/#{album.id}/download')
        .then((r) => done([r.status, r.headers.get('content-type')]));
    JS
    expect(status).to eq [200, 'application/zip']
  end
end
