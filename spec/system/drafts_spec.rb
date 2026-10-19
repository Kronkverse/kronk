# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Drafts: closing a composer keeps what was written, and it
# comes back when the composer opens again.
RSpec.describe 'Composer drafts', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    # The home feed asks the Huddle server how full the room is; there is none here.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'keeps an event through closing the composer, and discards it on request' do
    visit '/hub/kalendar/new'
    find('input[placeholder="What is happening?"]').fill_in(with: 'Mayhem working bee')

    expect(page).to have_css('.draft-bar__status', text: 'Saved')
    expect(Draft.find_by(account: bob.account, korner: 'kalendar', kind: 'event').params['title']).to eq('Mayhem working bee')

    find('.compose-shell__cancel').click
    expect(page).to have_no_css('.compose-shell')

    visit '/hub/kalendar/new'
    expect(page).to have_field(with: 'Mayhem working bee')
    expect(page).to have_css('.draft-bar__chip--current', text: 'Mayhem working bee')

    click_on 'Discard draft'
    within('.confirm-dialog') { click_on 'Discard draft' }

    expect(page).to have_no_field(with: 'Mayhem working bee')
    expect(page).to have_no_css('.draft-bar')
    expect(Draft.where(account: bob.account, korner: 'kalendar')).to be_empty
  end
end
