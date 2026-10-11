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
end
