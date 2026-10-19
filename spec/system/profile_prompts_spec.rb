# frozen_string_literal: true

require 'rails_helper'

# The + cards on your own profile (ProfilePrompts): where things could go,
# shown only to you, outside designing.
RSpec.describe 'Profile prompts', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:ana)                 { Fabricate(:user, account_attributes: { username: 'ana', display_name: 'Ana' }).account }

  before do
    as_a_logged_in_user
    # The home feed asks the Huddle server how full the room is; there is none here.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'offers an empty profile something to add, and starts designing from it' do
    visit "/@#{bob.account.username}"

    within('.profile-prompts') do
      expect(page).to have_content('Make it yours')
      expect(page).to have_css('.profile-prompts__card', text: 'Say who you are')
      find('.profile-prompts__card', text: 'Design your profile').click
    end

    expect(page).to have_css('.profile-shelves__save')
    expect(page).to have_no_css('.profile-prompts')
  end

  it 'opens the profile Kuestions from Say who you are' do
    visit "/@#{bob.account.username}"

    find('.profile-prompts__card', text: 'Say who you are').click

    expect(page).to have_css('.profile-face__about-you', text: 'Hide kuestions')
  end

  it "shows no prompts on someone else's profile" do
    visit "/@#{ana.username}"

    expect(page).to have_css('.profile-block__name', text: 'Ana')
    expect(page).to have_no_css('.profile-prompts')
  end
end
