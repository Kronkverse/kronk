# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/krew.md, The surfaces; decisions.md 2026-10-18: What's
# happening sits above the spaces, the tiles open their space below the
# grid, and the + moon follows it.
RSpec.describe 'Krew page', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      %w(albutts kalendar map).each { |korner| k.krew_korners.create!(korner: korner) }
    end
  end

  before { as_a_logged_in_user }

  def plus_moon
    find('.kronk-menu__trigger').click
    find('.kronk-menu__moon[title^="Post to"], .kronk-menu__moon[title^="New"]')['title']
  ensure
    find('.kronk-menu__trigger').click
  end

  it "shows What's happening above the spaces" do
    album = Album.create!(owner: bob.account, krew: krew, title: 'Mayhem 2026', visibility: :self_only, contribution: :invited)
    album.album_krews.create!(krew: krew, for_contribution: true)
    2.times do
      status = Fabricate(:status, account: bob.account, media_attachments: [Fabricate(:media_attachment, account: bob.account)])
      AlbumPhoto.create!(album: album, contributor: bob.account, status: status)
    end
    visit "/hub/krew/#{krew.slug}"

    within('.krew-detail__happening') do
      expect(page).to have_css('.krew-detail__happening-line', text: 'added 2 photos to Mayhem 2026')
      expect(page).to have_css('.krew-detail__happening-line', text: 'joined the Krew')
    end
    expect(page).to have_no_css('.space-tile', text: /What's happening/i)
    expect(page).to have_no_css('.space-tile--open')
    expect(plus_moon).to eq 'Post to Growers'
  end

  it 'has a tile for each space with a Krew part, then Add a space and Konnect' do
    krew.krew_korners.find_by(korner: 'kalendar').destroy
    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.space-tile', text: 'Albutts')
    # Map has no Krew part yet, so it has no tile.
    expect(page).to have_no_css('.space-tile', text: 'Map')
    tiles = all('.attachment-section > .space-tiles > li')
    expect(tiles[-2]).to have_text(/Add a space/i)
    expect(tiles.last).to have_text(/Konnect/i)
  end

  it 'opens a space added from the page with its link list ready' do
    krew.krew_korners.find_by(korner: 'kalendar').destroy
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Add a space' }
    within('.space-tiles--tray') { click_on 'Kalendar' }

    expect(page).to have_css('.space-tile--open', text: 'Kalendar')
    expect(page).to have_text('You have nothing coming up to link.')
    expect(page).to have_button('Link a past event')
  end

  it 'leaves out Add a space once every space with a Krew part is in' do
    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.space-tile', text: 'Konnect')
    expect(page).to have_no_css('.space-tile', text: /Add a space/i)
  end

  it 'opens the Konnect picker straight from Konnect' do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Konnect' }

    expect(page).to have_css('.attachment-picker', text: 'Konnect something')
  end

  it 'makes a new event for the Krew from the Konnect picker' do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') do
      click_on 'Kalendar'
      click_on 'New event for this Krew'
    end

    expect(page).to have_current_path("/hub/kalendar/composer?krew=#{krew.id}")
    expect(page).to have_css('.compose-shell', text: 'New event')
  end

  it 'opens the Krew albums in place, made with the + moon' do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Albutts' }

    expect(page).to have_css('.space-tile--open', text: 'Albutts')
    expect(page).to have_css('.krew-detail__albums')
    expect(page).to have_no_button('New Krew album')
    expect(plus_moon).to eq 'New Krew album'
  end

  it 'closes an open space on a second tap' do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Albutts' }
    expect(page).to have_css('.krew-detail__albums')

    within('.attachment-section') { click_on 'Albutts' }
    expect(page).to have_no_css('.krew-detail__albums')
    expect(plus_moon).to eq 'Post to Growers'
  end

  it 'opens the Krew events in place, made with the + moon' do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Kalendar' }

    expect(page).to have_text('Nothing coming up for this Krew yet')
    expect(page).to have_no_css('.krew-detail__albums')
    expect(plus_moon).to eq 'New event for this Krew'
  end

  it 'reads and sends in the Krew chat on the page' do
    sam = Fabricate(:account, username: 'sam', display_name: 'Sam')
    krew.krew_memberships.create!(account: sam, role: 'member', source: 'direct')
    Nudges::Conversation.krew_for!(krew).messages.create!(author_account: sam, body: 'Seeds are in')
    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.krew-detail__happening-line--chat', text: /unread/)
    expect(page).to have_no_css('.space-tile', text: 'Chat')
    within('.krew-detail__chat') do
      expect(page).to have_text('Seeds are in')
      expect(page).to have_link('Open in Nudges')
      find('.nudges-composer textarea').fill_in(with: 'On my way')
      click_button(class: 'nudges-composer__send')
      expect(page).to have_text('On my way')
    end
  end

  it 'opens People from the faces, with the people asking to join' do
    sam = Fabricate(:account, username: 'sam', display_name: 'Sam')
    KrewJoinRequest.create!(krew: krew, account: sam)
    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.krew-detail__faces-asking', text: '1 asking to join')
    expect(page).to have_no_button('Invite people')
    find('.krew-detail__faces').click

    within('.krew-detail__people') do
      expect(page).to have_text('Sam')
      expect(page).to have_button('Let them in')
      expect(page).to have_button('Invite people')
      expect(page).to have_css('.krew-detail__person', text: '@bob')
    end

    find('.krew-detail__faces').click
    expect(page).to have_no_css('.krew-detail__people')
  end
end
