# frozen_string_literal: true

require 'rails_helper'

# iOS Safari zooms into a text field under 16px on focus. On a touch screen
# every text field is at least 16px; a bigger one keeps its size; with a
# mouse nothing changes (kronk/_form.scss, No zoom on focus; Kommons "Fix
# zoom when typing on home screen app").
RSpec.describe 'Text fields on a touch screen', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:ana) { Fabricate(:account, username: 'ana', display_name: 'Ana') }

  def font_size(selector)
    expect(page).to have_css(selector)
    page.evaluate_script("parseFloat(getComputedStyle(document.querySelector(#{selector.to_json})).fontSize)")
  end

  def touch_screen!
    page.driver.with_playwright_page do |playwright_page|
      playwright_page.context.new_cdp_session(playwright_page)
                     .send_message('Emulation.setTouchEmulationEnabled', params: { enabled: true, maxTouchPoints: 5 })
    end
  end

  before do
    as_a_logged_in_user
    page.current_window.resize_to(390, 800)
  end

  it 'gives every composer 16px text, and keeps a title its own size' do
    Fabricate(:follow, account: bob.account, target_account: ana)
    Fabricate(:follow, account: ana, target_account: bob.account)
    Nudges::Conversation.mate_between!(bob.account, ana)
    touch_screen!

    visit '/publish'
    expect(page.evaluate_script("matchMedia('(pointer: coarse)').matches")).to be true
    expect(font_size('textarea.autosuggest-textarea__textarea')).to be >= 16

    visit "/nudges/with/#{ana.id}"
    expect(font_size('.nudges-composer__input')).to be >= 16

    visit '/hub/albutts/composer'
    expect(font_size('.compose-shell .compose-input')).to be >= 16
    expect(font_size('.compose-shell .compose-title')).to eq 22
  end

  it 'leaves the fields as they are with a mouse' do
    visit '/hub/albutts/composer'
    expect(page.evaluate_script("matchMedia('(pointer: coarse)').matches")).to be false
    expect(font_size('.compose-shell .compose-input')).to eq 15
    expect(font_size('.compose-shell .compose-title')).to eq 22
  end
end
