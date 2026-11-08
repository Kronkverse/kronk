# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/profile.md, Posts from Mates.
RSpec.describe 'Posts on a profile', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:ana)                 { Fabricate(:user, account_attributes: { username: 'ana', display_name: 'Ana' }).account }

  before do
    as_a_logged_in_user
    bob.account.follow!(ana)
    ana.follow!(bob.account)
    # The home feed asks the Huddle server how full the room is; there is none here.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it "writes a post on a Mate's profile from their profile" do
    visit '/@ana'

    find('button[title="Post on Ana’s profile"]').click
    expect(page).to have_css('.compose-form__profile-target', text: 'Posting on Ana’s profile')

    find('textarea.autosuggest-textarea__textarea').fill_in with: 'Happy birthday!'
    click_on 'Kronk it'

    expect(page).to have_no_css('.compose-form__profile-target')
    expect(Status.find_by(text: 'Happy birthday!')).to have_attributes(account_id: bob.account.id, profile_account_id: ana.id)
  end

  # Taking it off was in the post's … menu, gone on 2026-11-08 (docs/decisions.md).
  it "shows a Mate's post on your own profile" do
    PostStatusService.new.call(ana, text: 'Good to see you', visibility: 'public', profile_account_id: bob.account.id)
    visit "/@#{bob.account.username}"

    within('article', text: 'Good to see you') do
      expect(page).to have_css('.status__prepend', text: "On #{bob.account.username}’s profile")
    end
  end
end
