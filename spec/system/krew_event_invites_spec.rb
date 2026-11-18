# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kalendar.md, Events for a Krew (decisions.md, 2026-11-18): made
# from a Krew, the event is just the Krew's or open and hosted by it, and
# inviting everyone in the Krew is a choice. An event for the Krew alone is
# asked of its members only.
RSpec.describe 'Krew event invites', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:sam)  { Fabricate(:account, username: 'samwise', display_name: 'Sam Gardener') }
  let(:rosa) { Fabricate(:account, username: 'samantha', display_name: 'Sam Outsider') }
  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      k.krew_memberships.create!(account: sam, role: 'member', source: 'direct')
      k.krew_korners.create!(korner: 'kalendar')
    end
  end

  before do
    as_a_logged_in_user
    rosa
    # Search results show avatars; the test server has none to serve.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  def open_composer(title)
    visit "/hub/kalendar/composer?konnect=krew:#{krew.id}"
    find('input[placeholder="What is happening?"]').set(title)
  end

  def search_invitees(query)
    find('.event-composer__invitee-search input').set(query)
  end

  def invited_to(title)
    EventInvitation.where(event: Event.find_by!(title: title)).pluck(:account_id)
  end

  it 'starts as just the Krew, picks only from its members, and invites only who is picked', :aggregate_failures do
    open_composer('Working bee')

    within('.compose-shell') do
      expect(page).to have_css('.korner-pill--active', text: 'Just the Krew')
      expect(page).to have_css('.korner-pill--active', text: 'Pick people')
      search_invitees('sam')
      within('.event-composer__invitee-results') do
        expect(page).to have_button(text: 'Sam Gardener')
        expect(page).to have_no_button(text: 'Sam Outsider')
        click_on 'Sam Gardener'
      end
      click_on 'Post it'
    end

    expect(page).to have_current_path('/hub/kalendar/working-bee')
    expect(invited_to('Working bee')).to contain_exactly(sam.id)
  end

  it 'invites everyone in the Krew when asked, with nobody to pick', :aggregate_failures do
    open_composer('Harvest')

    within('.compose-shell') do
      click_on 'Everyone in the Krew'
      expect(page).to have_no_css('.event-composer__invitee-search')
      click_on 'Post it'
    end

    expect(page).to have_current_path('/hub/kalendar/harvest')
    expect(invited_to('Harvest')).to contain_exactly(sam.id)
  end

  it 'picks from all of Kronk for an event the Krew hosts in the open', :aggregate_failures do
    open_composer('Open day')

    within('.compose-shell') do
      click_on 'Open, hosted by the Krew'
      search_invitees('sam')
      within('.event-composer__invitee-results') do
        expect(page).to have_button(text: 'Sam Gardener')
        click_on 'Sam Outsider'
      end
      click_on 'Post it'
    end

    expect(page).to have_current_path('/hub/kalendar/open-day')
    expect(invited_to('Open day')).to contain_exactly(rosa.id)
  end

  it "searches only the Krew's members from the event page's Invite" do
    open_composer('Seed swap')
    within('.compose-shell') { click_on 'Post it' }
    expect(page).to have_current_path('/hub/kalendar/seed-swap')

    find('button[aria-label="Invite"]').click
    find('.event-detail__invite-search input').set('sam')

    within('.event-detail__invite-results') do
      expect(page).to have_text('Sam Gardener')
      expect(page).to have_no_text('Sam Outsider')
    end
  end
end
