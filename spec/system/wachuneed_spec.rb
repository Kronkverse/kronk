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

  it 'says so properly when nothing is listed' do
    visit '/hub/wachuneed'

    expect(page).to have_css('.empty-state__title', text: 'Nothing on offer yet')
    expect(page).to have_css('.empty-state__body', text: 'New listing')
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
