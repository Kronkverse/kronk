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

  # Kommons "Home Page" (117522482475089755).
  it 'opens on a row each of Offered, Desired and Shops, each with See all' do
    ana = Fabricate(:account, username: 'ana')
    Listing.create!(account: ana, title: 'Clay mug', category: 'creation', state: 'live')
    Listing.create!(account: ana, title: 'A ladder', category: 'goods', kind: 'wanted', state: 'live')

    visit '/hub/wachuneed'

    within('section[aria-label="Offered"]') { expect(page).to have_css('.space-grid--row .space-card', text: 'Clay mug') }
    within('section[aria-label="Desired"]') do
      expect(page).to have_css('.space-grid--row .space-card', text: 'A ladder')
      expect(page).to have_no_content('Clay mug')
    end
    # No shop yet, so no Shops row.
    expect(page).to have_no_css('section[aria-label="Shops"]')

    within('section[aria-label="Offered"]') { click_on 'See all' }
    expect(page).to have_current_path('/hub/wachuneed/offered')
    expect(page).to have_css('.space-grid .space-card', text: 'Clay mug')
  end

  it 'takes the old section addresses to the new ones' do
    visit '/hub/wachuneed/wachugot'

    expect(page).to have_current_path('/hub/wachuneed/mine')
    expect(page).to have_css('.empty-state__title', text: "You haven't listed anything yet")
  end

  # docs/spaces/wachuneed.md, Shops.
  describe 'shops' do
    it 'opens a shop from the Ж menu on Shops, with a Kollection, and lands on its page' do
      visit '/hub/wachuneed/shops'

      find('.kronk-menu__trigger').click
      find('.kronk-menu__moon[title="Open a shop"]').click
      fill_in 'Shop name', with: 'Bob Aromas'
      click_on 'Add a Kollection'
      fill_in 'Kollection name', with: 'Skin Care'
      click_on 'Open shop'

      expect(page).to have_current_path("/hub/wachuneed/shop/#{bob.account.username}")
      expect(page).to have_css('.korner-detail__title', text: 'Bob Aromas')
      expect(ListingShop.find_by(account: bob.account).sections.pluck(:name)).to eq ['Skin Care']
    end

    context 'with a stocked shop' do
      before do
        shop    = ListingShop.create!(account: bob.account, name: 'Bob Aromas')
        section = shop.sections.create!(name: 'Skin Care')
        Listing.create!(account: bob.account, title: 'Balm', category: 'goods', state: 'live', listing_shop_section: section)
        Listing.create!(account: bob.account, title: 'Loose candle', category: 'goods', state: 'live')
      end

      it 'shows the shop in the Shops row of the landing and its listings under their sections' do
        visit '/hub/wachuneed'

        # A card, as in Shops, not a pill.
        within('section[aria-label="Shops"]') do
          expect(page).to have_css('.space-grid--row .space-card', text: '2 listings')
          click_on 'Bob Aromas'
        end

        expect(page).to have_css('.korner-detail__title', text: 'Bob Aromas')
        expect(page).to have_content('2 listings')
        expect(page).to have_css('.wachuneed-shop__section-name', text: 'Skin Care')
        within('.wachuneed-shop__section', text: 'Skin Care') { expect(page).to have_content('Balm') }
        within('.wachuneed-shop__section', text: 'Everything else') { expect(page).to have_content('Loose candle') }
      end

      it 'lists the shop in Shops, and its front is the standard detail page with its sections to jump to' do
        visit '/hub/wachuneed/shops'

        within('.space-grid') { click_on 'Bob Aromas' }

        expect(page).to have_current_path("/hub/wachuneed/shop/#{bob.account.username}")
        expect(page).to have_css('.korner-detail__title', text: 'Bob Aromas')
        expect(page).to have_button('Skin Care (1)')
        # Your own shop: nobody to message, and Edit is on the Ж menu.
        expect(page).to have_no_button('Message the seller')
      end

      it 'shows your shop as a card at the top of Mine, and + in the shop adds an item to it' do
        visit '/hub/wachuneed/mine'

        expect(page).to have_css('.wachuneed-shops .space-card', text: 'Bob Aromas')
        expect(page).to have_no_button('See my shop')
        within('.wachuneed-shops') { click_on 'Bob Aromas' }

        expect(page).to have_css('.korner-detail__title', text: 'Bob Aromas')
        find('.kronk-menu__trigger').click
        find('.kronk-menu__moon[title="Add an item"]').click

        expect(page).to have_css('.compose-shell')
        within('.compose-shell') { expect(page).to have_field('What is it called?') }
      end

      # Kommons "Kollections" (117522474156930637).
      it 'shows each Kollection as a row, and lets the owner move an item into one and add a Kollection' do
        visit "/hub/wachuneed/shop/#{bob.account.username}"

        expect(page).to have_css('.wachuneed-shop__section .space-grid--row', count: 2)
        within('.wachuneed-shop__section', text: 'Everything else') { expect(page).to have_content('Loose candle') }
        # The owner's tile at the end of each row.
        within('.wachuneed-shop__section', text: 'Skin Care') { expect(page).to have_link('Add an item') }

        click_on 'Arrange Kollections'
        find('select[aria-label="Kollection for Loose candle"]').select('Skin Care')

        within('.wachuneed-shop__section', text: 'Skin Care') { expect(page).to have_content('Loose candle') }
        expect(Listing.find_by(title: 'Loose candle').listing_shop_section.name).to eq 'Skin Care'

        click_on 'Add a Kollection'
        expect(page).to have_current_path('/hub/wachuneed/my-shop?kollection=new')
        expect(page).to have_field('Kollection name', count: 2)
      end

      it 'shows a visitor only the Kollections with something in them, with no owner controls' do
        ana  = Fabricate(:account, username: 'ana')
        shop = ListingShop.create!(account: ana, name: 'Ana Oils')
        oils = shop.sections.create!(name: 'Oils', position: 0)
        shop.sections.create!(name: 'Tinctures', position: 1)
        Listing.create!(account: ana, title: 'Rose oil', category: 'goods', state: 'live', listing_shop_section: oils)

        visit '/hub/wachuneed/shop/ana'

        expect(page).to have_css('.wachuneed-shop__section-name', text: 'Oils')
        expect(page).to have_no_css('.wachuneed-shop__section-name', text: 'Tinctures')
        expect(page).to have_no_link('Add an item')
        expect(page).to have_no_button('Arrange Kollections')
      end

      it 'leads from the Wachuneed shelf on the profile to the shop, not from under the profile header' do
        ListingShop.find_by(account: bob.account).update!(show_on_profile: true)
        Wachuneed::PublishListing.new(Listing.find_by(title: 'Balm')).call
        Fabricate(:profile_section, account: bob.account, settings: { 'render' => 'wachuneed_card', 'korner_slug' => 'wachuneed' })

        visit "/@#{bob.account.username}"

        within('.profile-shelves__shelf--drawn-wachuneed_card') { click_on 'Shop: Bob Aromas' }
        expect(page).to have_css('.korner-detail__title', text: 'Bob Aromas')
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

  # docs/spaces/wachuneed.md, The shop builder.
  describe 'the shop builder' do
    before { ListingShop.create!(account: bob.account, name: 'Bob Bottles') }

    it 'adds an item that comes in sizes and colours, priced by size, quietly' do
      visit '/hub/wachuneed/my-shop'
      click_on 'Add an item'

      # The shop item composer, in the shared shell over the list.
      within('.compose-shell') do
        expect(page).to have_no_content('What are you posting?')
        fill_in 'What is it called?', with: 'Water bottle'
        say_what_it_comes_in
        click_on 'Add item'
      end

      expect(page).to have_no_css('.compose-shell')
      expect(page).to have_current_path('/hub/wachuneed/my-shop')
      expect(page).to have_css('.wachuneed-shop-items__item', text: 'Water bottle')
      expect(page).to have_content('From A$25.00')

      bottle = Listing.find_by(title: 'Water bottle')
      expect(bottle).to have_attributes(ongoing: true, announced: false, status_id: nil, price_cents: 2500)
      expect(bottle.variants['axes'].pluck('name')).to eq %w(Size Colour)
      expect(bottle.variants['items'].find { |item| item['values'] == %w(1L Blue) })
        .to include('price_cents' => 3500, 'availability' => 'sold_out')
    end

    it 'adds one item after another, then changes one from the list' do
      visit '/hub/wachuneed/my-shop?item=new'

      within('.compose-shell') do
        fill_in 'What is it called?', with: 'Lip balm'
        fill_in 'Price (in AUD)', with: '8'
        check 'Add another after this one'
        click_on 'Add item'

        expect(page).to have_content('Added Lip balm.')
        fill_in 'What is it called?', with: 'Hand cream'
        uncheck 'Add another after this one'
        click_on 'Add item'
      end

      expect(page).to have_css('.wachuneed-shop-items__item', count: 2)

      within('.wachuneed-shop-items__item', text: 'Lip balm') { click_on 'Edit' }
      within('.compose-shell') do
        expect(page).to have_field('What is it called?', with: 'Lip balm')
        fill_in 'Price (in AUD)', with: '9.5'
        click_on 'Save'
      end

      expect(page).to have_css('.wachuneed-shop-items__item', text: 'A$9.50')
      expect(Listing.find_by(title: 'Lip balm')).to have_attributes(price_cents: 950, ongoing: true, announced: false)
    end

    # Sizes then colours, priced by size, and the big blue one gone.
    def say_what_it_comes_in
      within('.wachuneed-variants-edit') do
        add_variation 'Size', %w(500ml 1L)
        add_variation 'Colour', %w(Red Blue)

        select 'By Size', from: 'Set prices for'
        find('input[aria-label="Price for 500ml (AUD)"]').fill_in with: '25'
        find('input[aria-label="Price for 1L (AUD)"]').fill_in with: '35'
        click_on 'Fill in'
        find('select[aria-label="Availability of 1L · Blue"]').select 'Sold out'
      end
    end

    # A variation is named by the seller, and its choices go in one at a time.
    def add_variation(name, choices)
      names = 'input[aria-label="Variation name"]'
      rows = all(names, minimum: 0).size
      click_on 'Add a variation'
      # `all` only waits when told how many to expect.
      all(names, count: rows + 1).last.fill_in with: name
      choices.each do |choice|
        find("input[aria-label=\"A choice of #{name}\"]").fill_in(with: choice).send_keys(:enter)
      end
    end

    it 'lets a buyer pick the kind and how many, and prices that' do
      seller = Fabricate(:account, username: 'ana')
      bottle = Listing.create!(
        account: seller, title: 'Water bottle', category: 'goods', state: 'live', ongoing: true,
        variants: {
          axes: [{ name: 'Size', values: %w(500ml 1L) }, { name: 'Colour', values: %w(Red Blue) }],
          items: [
            { values: %w(500ml Red), price_cents: 2500 }, { values: %w(500ml Blue), price_cents: 2500 },
            { values: %w(1L Red), price_cents: 3500 }, { values: %w(1L Blue), price_cents: 3500, availability: 'sold_out' }
          ],
        }
      )
      visit "/hub/wachuneed/listings/#{bottle.id}"

      find('.wachuneed-options__choice', text: '1L').click
      find('.wachuneed-options__choice', text: 'Red').click
      expect(page).to have_css('.wachuneed-detail__total', text: 'Total A$35.00')

      fill_in 'How many', with: '2'
      expect(page).to have_css('.wachuneed-detail__total', text: 'Total A$70.00')

      find('.wachuneed-options__choice', text: 'Blue').click
      expect(page).to have_css('.wachuneed-variants__state', text: 'Sold out')
    end
  end

  # docs/spaces/wachuneed.md, Options.
  describe 'options' do
    it 'lets a seller add an option from the suggestions, with what a choice adds' do
      visit '/hub/wachuneed/new'

      fill_in 'A short name — what is it?', with: 'Massage'
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

  # docs/spaces/wachuneed.md, Booking (Kommons "Goods & Services").
  describe 'booking' do
    it 'builds a listing from a template, changes its parts, and shows them on its page' do
      visit '/hub/wachuneed/new'

      fill_in 'A short name — what is it?', with: 'Garden help'
      choose 'Offerings'
      click_on 'Job'
      # A job starts as a time, a from and a to, and what to ask; this one
      # needs no from and to, takes two hours, and posts one time.
      uncheck 'From and to'
      select '2 hours', from: 'How long'
      fill_in 'What to ask them', with: 'How big is the garden?'
      click_on 'Add a time'
      find('input[aria-label="A time you post"]').fill_in with: 1.week.from_now.strftime('%Y-%m-%dT10:00')
      click_on 'Publish listing'

      expect(page).to have_current_path('/hub/wachuneed/mine')
      listing = Listing.last
      expect(listing.booking).to include('parts' => %w(time details), 'template' => 'job', 'minutes' => 120, 'ask' => 'How big is the garden?')
      expect(listing.booking['slots'].size).to eq 1

      visit "/hub/wachuneed/listings/#{listing.id}"

      within('.wachuneed-booking-summary') do
        expect(page).to have_content('2 hours').or have_content('120 minutes')
        expect(page).to have_content('How big is the garden?')
        expect(page).to have_no_content('A from and a to')
      end
    end

    it 'books a free time with what is asked, for the seller to see in Requests' do
      ana   = Fabricate(:account, username: 'ana')
      start = 2.days.from_now.utc.change(hour: 10)
      listing = Listing.create!(account: ana, title: 'Reiki', category: 'service', state: 'live',
                                booking: { parts: %w(time details), minutes: 60, time_zone: 'UTC',
                                           slots: [start.iso8601], ask: 'Anything I should know?' })

      visit "/hub/wachuneed/listings/#{listing.id}"

      expect(page).to have_button('Book', disabled: true)
      within('.wachuneed-book__day-times') { find('.korner-pill').click }
      fill_in 'Anything I should know?', with: 'A sore shoulder'
      click_on 'Book'

      expect(page).to have_content('Booked. You will hear when they say yes.')
      expect(ListingOffer.last).to have_attributes(starts_at: start, ends_at: start + 1.hour, details: 'A sore shoulder', state: 'pending')
    end

    it 'lets the one who booked call an accepted booking off' do
      ana     = Fabricate(:account, username: 'ana')
      listing = Listing.create!(account: ana, title: 'Reiki', category: 'service', state: 'live',
                                booking: { parts: %w(time), minutes: 60 })
      ListingOffer.ask(listing, offerer: bob.account, starts_at: 3.days.from_now.utc.change(hour: 9)).tap(&:save!).accept!

      visit '/hub/wachuneed/requests'

      click_on 'Call it off'
      within('.confirm-dialog__panel') { click_on 'Call it off' }

      expect(page).to have_content('You called it off.')
      expect(ListingOffer.last.state).to eq 'cancelled'
    end

    it 'puts an accepted booking in Kalendar under Me, leading to the listing' do
      ana     = Fabricate(:account, username: 'ana', display_name: 'Ana')
      listing = Listing.create!(account: ana, title: 'Reiki', category: 'service', state: 'live',
                                booking: { parts: %w(time), minutes: 60 })
      ListingOffer.ask(listing, offerer: bob.account, starts_at: 3.days.from_now.utc.change(hour: 9)).tap(&:save!).accept!

      visit '/hub/kalendar/me'

      within('.kalendar-bookings') do
        expect(page).to have_content('Reiki with Ana')
        click_on 'Reiki'
      end
      expect(page).to have_current_path(%r{/hub/wachuneed/listings/})
    end

    it 'turns booking off again with Ask for this' do
      listing = Listing.create!(account: bob.account, title: 'Reiki', category: 'service', state: 'live',
                                booking: { template: 'appointment', parts: %w(time), minutes: 60, hours: [{ day: 1, from: '09:00', to: '17:00' }] })

      visit "/hub/wachuneed/listings/#{listing.slug}/edit"
      expect(page).to have_field('How long', with: '60')
      click_on 'Ask for this'
      click_on 'Save changes'

      expect(page).to have_no_current_path(%r{/edit\z})
      expect(listing.reload.booking).to eq({})
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

      expect(page).to have_current_path("/hub/wachuneed/listings/#{Listing.last.slug}/edit")
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

  # docs/spaces/wachuneed.md, Brands.
  describe 'brands' do
    it 'proposes a brand from Proposed and lands on its page, waiting for backers' do
      visit '/hub/wachuneed/brands?show=proposed'

      expect(page).to have_css('.empty-state__title', text: 'Nothing waiting for backers')
      within('.empty-state') { click_on 'Propose a brand' }
      find('[aria-label="Name"]').set('Patagonia')
      find('input[placeholder="https://"]').set('https://www.patagonia.com')
      find('[aria-label="Why we back them"]').set('They repair what they sell.')
      click_on 'Propose', exact: true

      expect(page).to have_current_path(%r{\A/hub/wachuneed/brands/\d+\z})
      brand = WachuneedBrand.find_by!(name: 'Patagonia')
      expect(page).to have_current_path("/hub/wachuneed/brands/#{brand.id}")
      expect(page).to have_css('.wachuneed-brand__why', text: 'They repair what they sell.')
      expect(page).to have_text('1 of 3 backers')
      expect(brand.backers).to eq [bob.account]
    end

    it 'lists a brand once enough members back it, and opens it from the list' do
      brand = WachuneedBrand.create!(account: Fabricate(:account), name: 'Fairphone', url: 'https://www.fairphone.com', why: 'Phones you can fix.')
      brand.back!(Fabricate(:account))
      brand.back!(Fabricate(:account))

      visit '/hub/wachuneed/brands'

      click_on 'Fairphone'

      expect(page).to have_current_path("/hub/wachuneed/brands/#{brand.id}")
      expect(page).to have_css('.wachuneed-brand__why', text: 'Phones you can fix.')
      click_on 'Back this brand'

      expect(page).to have_text('4 backers')
      expect(brand.reload.backed_by?(bob.account)).to be true
    end
  end
end
