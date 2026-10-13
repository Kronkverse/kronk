# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md: a listing's photos, on its feed card and its page.
RSpec.describe 'Wachuneed', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    # Fabricated uploads have no resized files on disk for the browser to fetch.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'says so properly when nothing is listed, and offers the way in' do
    visit '/hub/wachuneed'

    expect(page).to have_css('.empty-state__title', text: 'Nothing on offer yet')
    click_on 'List something'

    expect(page).to have_current_path('/hub/wachuneed/new')
  end

  it 'names its sections Offered, Desired and Mine, and posts a wanted ad from Desired' do
    visit '/hub/wachuneed/desired'

    expect(page).to have_css('.empty-state__title', text: 'Nobody is looking for anything yet')
    click_on 'Post a wanted ad'

    expect(page).to have_current_path('/hub/wachuneed/new?kind=wanted')
    expect(page).to have_checked_field("Something I'm looking for")
  end

  it 'takes the old section addresses to the new ones' do
    visit '/hub/wachuneed/wachugot'

    expect(page).to have_current_path('/hub/wachuneed/mine')
    expect(page).to have_css('.empty-state__title', text: "You haven't listed anything yet")
  end

  context 'with a listing that has two photos' do
    before do
      listing = Listing.create!(account: bob.account, title: 'Red bike', category: 'goods', state: 'live')
      2.times do |position|
        ListingPhoto.create!(listing: listing, position: position,
                             media_attachment: Fabricate(:media_attachment, account: bob.account, status: nil))
      end
      Wachuneed::PublishListing.new(listing).call
    end

    it 'gives the poster Edit listing in the Ж menu on the listing page' do
      visit "/hub/wachuneed/listings/#{Listing.last.id}"

      expect(page).to have_content('Red bike')
      find('.kronk-menu__trigger').click
      click_on 'Edit listing'

      expect(page).to have_current_path("/hub/wachuneed/listings/#{Listing.last.id}/edit")
      expect(page).to have_field(with: 'Red bike')
    end

    it 'lets the poster take the listing down from the edit form' do
      listing = Listing.last
      visit "/hub/wachuneed/listings/#{listing.id}/edit"

      click_on 'Take down listing'
      click_on 'Take it down'

      expect(page).to have_current_path('/hub/wachuneed/mine')
      expect(listing.reload).to have_attributes(state: 'closed', status_id: nil)
    end

    it 'lets you look through them on the feed card without leaving the feed' do
      visit '/home'

      within('.status-wachuneed-card') do
        expect(page).to have_css('.listing-photos__photo', count: 2)
        expect(page).to have_css('.listing-photos__count', text: '1 / 2')

        find('.listing-photos__step--next').click

        expect(page).to have_css('.listing-photos__count', text: '2 / 2')
      end
      expect(page).to have_current_path('/home')
    end

    it 'opens the listing from the card, with the same photos' do
      visit '/home'

      find('.status-wachuneed-card .status-korner-card__title').click

      expect(page).to have_css('.wachuneed-detail__title', text: 'Red bike')
      expect(page).to have_css('.listing-photos--full .listing-photos__photo', count: 2)
    end
  end
end
