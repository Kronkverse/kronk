# frozen_string_literal: true

require 'rails_helper'

# Kommons "Album Description" (117486897103076402): someone adding photos
# wrote about the whole album in the only box the Add photos form had, which
# was each photo's caption labelled "Add a description". The story became the
# first photo's caption. Now the album's description is its own field, for
# whoever runs the album, and each photo's box says it is that photo's caption.
RSpec.describe 'Album description when adding photos', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:story) { 'Rolls of film from years ago, finally processed.' }

  before do
    as_a_logged_in_user
    # Specs skip image processing, so an uploaded photo has no resized files
    # for the album's thumbnails to load (as in albutts_spec).
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  def open_add_photos(album)
    visit "/hub/albutts/albums/#{album.id}"
    find('.kronk-menu__trigger').click
    find('.kronk-menu__moon[title="Add photos"]').click
    expect(page).to have_css('.compose-shell')
  end

  it 'puts the album description on the album and the caption on the photo' do
    album = Album.create!(owner: bob.account, title: 'Northern Rivers', visibility: :public)
    open_add_photos(album)

    within('.compose-shell') do
      fill_in 'Album description', with: story
      attach_file('albutts-contribute-file', file_fixture('600x400.png'), make_visible: true)
      expect(page).to have_content('Each box below is the caption for that one photo.')
      find('textarea[placeholder="Caption for this photo (optional)"]').set('The fire pit')
      click_on 'Add 1 photo to album'
    end

    expect(page).to have_no_css('.compose-shell')
    expect(album.reload.description).to eq story
    expect(album.photos.map { |p| p.status.text }).to eq ['The fire pit']
    expect(page).to have_css('.albutts-detail__description', text: story)
  end

  it "tells someone who doesn't run the album that each box is one photo's caption" do
    owner = Fabricate(:account, username: 'mangobee')
    album = Album.create!(owner: owner, title: 'Northern Rivers', visibility: :public, contribution: :open)
    open_add_photos(album)

    within('.compose-shell') do
      expect(page).to have_no_field('Album description')
      attach_file('albutts-contribute-file', file_fixture('600x400.png'), make_visible: true)
      expect(page).to have_content("The album's description is written by whoever runs the album.")
      expect(page).to have_css('textarea[placeholder="Caption for this photo (optional)"]')
      expect(page).to have_no_css('textarea[placeholder="Add a description (optional)"]')
    end
  end
end
