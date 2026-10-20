# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/nudges.md: Push. Each row has In Nudges and Push switches.
RSpec.describe 'Nudge push settings', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  def switch(label)
    find("input[aria-label='#{label}']", visible: :all)
  end

  it 'keeps a row off the phone, and greys out Push for a row hidden from Nudges' do
    visit '/settings/notifications'

    expect(page).to have_text('Notifications here')
    switch('A Mate sends you a message: push to my phone').find(:xpath, '..').click
    expect(page).to have_text('Saved')
    expect(bob.reload.settings['nudges.push_off_types']).to eq(['messages.mate'])

    switch('A Mate sends you a rose: show in Nudges').find(:xpath, '..').click
    expect(switch('A Mate sends you a rose: push to my phone')).to be_disabled
    expect(page).to have_text('Saved')
    expect(bob.reload.settings['nudges.muted_types']).to eq(['rose.received'])
  end
end
