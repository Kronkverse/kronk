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

  # docs/spaces/wachuneed.md, Shops.
  describe 'shops' do
    it 'opens a shop from Mine, with a section, and lands on its page' do
      visit '/hub/wachuneed/mine'

      click_on 'Open a shop'
      fill_in 'Shop name', with: 'Bob Aromas'
      click_on 'Add a section'
      fill_in 'Section name', with: 'Skin Care'
      click_on 'Open shop'

      expect(page).to have_current_path("/hub/wachuneed/shop/#{bob.account.username}")
      expect(page).to have_css('.wachuneed-shop__name', text: 'Bob Aromas')
      expect(ListingShop.find_by(account: bob.account).sections.pluck(:name)).to eq ['Skin Care']
    end

    context 'with a stocked shop' do
      before do
        shop    = ListingShop.create!(account: bob.account, name: 'Bob Aromas')
        section = shop.sections.create!(name: 'Skin Care')
        Listing.create!(account: bob.account, title: 'Balm', category: 'goods', state: 'live', listing_shop_section: section)
        Listing.create!(account: bob.account, title: 'Loose candle', category: 'goods', state: 'live')
      end

      it 'shows the shop across the top of Offered and its listings under their sections' do
        visit '/hub/wachuneed'

        within('.wachuneed-shops') do
          expect(page).to have_content('2 listings')
          click_on 'Bob Aromas'
        end

        expect(page).to have_css('.wachuneed-shop__section-name', text: 'Skin Care')
        within('.wachuneed-shop__section', text: 'Skin Care') { expect(page).to have_content('Balm') }
        within('.wachuneed-shop__section', text: 'Everything else') { expect(page).to have_content('Loose candle') }
      end

      it 'leads from a listing to the shop, and lets the owner place a listing in a section' do
        listing = Listing.find_by(title: 'Loose candle')
        visit "/hub/wachuneed/listings/#{listing.id}"

        expect(page).to have_link('See everything from Bob Aromas')

        visit "/hub/wachuneed/listings/#{listing.id}/edit"
        select 'Skin Care', from: 'Section of your shop'
        click_on 'Save changes'

        expect(page).to have_current_path("/hub/wachuneed/listings/#{listing.id}")
        expect(listing.reload.listing_shop_section.name).to eq 'Skin Care'
      end
    end
  end

  # docs/spaces/wachuneed.md, Options.
  describe 'options' do
    it 'lets a seller add an option from the suggestions, with what a choice adds' do
      visit '/hub/wachuneed/new'

      fill_in 'Title', with: 'Massage'
      choose 'Offerings'
      fill_in 'Price (in AUD)', with: '50'
      click_on 'Length'
      # "30 minutes" and "1 hour" arrive filled in; the hour costs more.
      all('input[aria-label="Adds (AUD)"]').last.fill_in with: '40'
      click_on 'Publish listing'

      expect(page).to have_current_path('/hub/wachuneed/mine')
      expect(Listing.last.options).to eq [
        { 'name' => 'Length', 'choices' => [{ 'label' => '30 minutes', 'extra_cents' => 0 }, { 'label' => '1 hour', 'extra_cents' => 4000 }] },
      ]
    end

    it 'lets a buyer choose, and adds it up' do
      seller  = Fabricate(:account, username: 'ana')
      listing = Listing.create!(account: seller, title: 'Massage', category: 'service', state: 'live', price_cents: 5000, price_currency: 'AUD',
                                options: [{ name: 'Length', choices: [{ label: '30 minutes' }, { label: '1 hour', extra_cents: 4000 }] }])
      visit "/hub/wachuneed/listings/#{listing.id}"

      within('.wachuneed-options') do
        expect(page).to have_css('.wachuneed-options__total', text: 'Total A$50.00')
        find('.wachuneed-options__choice', text: '1 hour').click
        expect(page).to have_css('.wachuneed-options__total', text: 'Total A$90.00')
      end
    end
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
