# frozen_string_literal: true

require 'rails_helper'

# Tal's proposal "Konnected sources" (2026-11-18): what a Krew makes in
# another space backs up to the Krew, not to that space.
RSpec.describe 'Konnected sources come back to the Krew', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:krew) do
    Krew.create!(slug: 'painters', name: 'Painters', access: 'open', seeded_by: bob.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      k.krew_korners.create!(korner: 'albutts')
    end
  end

  before { as_a_logged_in_user }

  it 'backs up from a new album to the Krew it was made from' do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Albutts' }
    within('.krew-detail__albums') { click_on 'New' }
    find('.compose-title').set('Open studio')
    click_on 'Create album'

    expect(page).to have_no_css('.compose-shell')
    expect(page).to have_css('h1', text: 'Open studio')
    expect(page).to have_css('.space-badge', text: 'Painters')
    find('.space-badge').click
    expect(page).to have_current_path("/hub/krew/#{krew.slug}")

    within('.krew-detail__albums') { click_on 'Open studio' }
    expect(page).to have_css('h1', text: 'Open studio')
    expect(page).to have_css('.space-badge', text: 'Painters')
  end
end
