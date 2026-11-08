# frozen_string_literal: true

require 'rails_helper'

# Kommons "Admin Functionality": admins reach the admin pages from /me.
RSpec.describe 'Admin from Me', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  it 'offers Admin to an admin' do
    as_a_logged_in_admin
    visit '/me'

    expect(page).to have_link('Admin', href: '/admin/dashboard')
  end

  it 'offers nothing to everyone else' do
    as_a_logged_in_user
    visit '/me'

    expect(page).to have_link('Settings')
    expect(page).to have_no_link('Admin')
  end
end
