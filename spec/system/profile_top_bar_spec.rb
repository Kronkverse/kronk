# frozen_string_literal: true

require 'rails_helper'

# Kommons "Mateing page" (2026-11-08): the top of a profile sat under the
# top bar, worst on a profile you can't see yet, whose picture and name were
# half hidden. The top rail fades out 5.5rem down; a profile starts below it.
RSpec.describe 'A profile under the top bar', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    page.current_window.resize_to(935, 985)
  end

  # Where the block and the person's picture start, against the rail's fade.
  def tops
    page.evaluate_script(<<~JS)
      (() => {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const top = (sel) => document.querySelector(sel).getBoundingClientRect().top;
        return { block: top('.profile-block'), picture: top('.profile-block__ident > *'), fade: 5.5 * rem };
      })()
    JS
  end

  it 'starts a profile you cannot see yet below the bar, picture and all' do
    Fabricate(:account, username: 'phoenix', display_name: 'Phoenix').update!(profile_visibility: 'mates')
    visit '/@phoenix'
    expect(page).to have_content('You need to be Mates')

    box = tops
    expect(box['block']).to be >= box['fade']
    expect(box['picture']).to be >= box['fade']
  end

  it 'starts your own profile, cover first, below the bar' do
    visit "/@#{bob.account.username}"
    expect(page).to have_css('.profile-block__cover')

    expect(tops['block']).to be >= tops['fade']
  end
end
