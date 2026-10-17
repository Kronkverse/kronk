# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Share: on every page of every space. No Invite.
RSpec.describe 'Share', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it 'has no Invite in the Ж menu' do
    visit '/hub/wachuneed'

    find('.kronk-menu__trigger').click
    expect(page).to have_button('Share')
    expect(page).to have_no_button('Invite')
  end

  it 'offers Share in the Ж menu, with the page\'s link to copy' do
    visit '/hub/kommons'

    find('.kronk-menu__trigger').click
    click_on 'Share'

    expect(page).to have_button('Copy link')
  end
end
