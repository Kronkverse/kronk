# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/krew.md, The surfaces; decisions.md 2026-10-18: the Krew
# page's tiles open their space below the grid, and the + moon follows it.
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

  it "opens on What's happening, with a tile for each space that has a Krew part" do
    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.krew-detail__space-tile--open[aria-pressed="true"]', text: /What's happening/i)
    expect(page).to have_css('.krew-detail__space-tile', text: 'Albutts')
    expect(page).to have_css('.krew-detail__space-tile', text: 'Kalendar')
    # Map has no Krew part yet, so it has no tile.
    expect(page).to have_no_css('.krew-detail__space-tile', text: 'Map')
    expect(plus_moon).to eq 'Post to Growers'
  end

  it 'opens the Krew albums in place, made with the + moon' do
    visit "/hub/krew/#{krew.slug}"
    within('.krew-detail__space-grid') { click_on 'Albutts' }

    expect(page).to have_css('.krew-detail__space-tile--open', text: 'Albutts')
    expect(page).to have_css('.krew-detail__albums')
    expect(page).to have_no_css('.krew-detail__feed')
    expect(page).to have_no_button('New Krew album')
    expect(plus_moon).to eq 'New Krew album'
  end

  it 'opens the Krew events in place, made with the + moon' do
    visit "/hub/krew/#{krew.slug}"
    within('.krew-detail__space-grid') { click_on 'Kalendar' }

    expect(page).to have_text('Nothing coming up for this Krew yet')
    expect(page).to have_no_css('.krew-detail__albums')
    expect(plus_moon).to eq 'New event for this Krew'
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
    expect(page).to have_no_css('.krew-detail__feed')

    find('.krew-detail__faces').click
    expect(page).to have_css('.krew-detail__feed')
  end
end
