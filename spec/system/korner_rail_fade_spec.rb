# frozen_string_literal: true

require 'rails_helper'

# docs/design.md (Frame): the right rail's fade lives in its own reserved
# track; the Stage stops at the fade's inner edge and never runs under it.
RSpec.describe 'Korner rail fade', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  # How far the Stage reaches past the fade's soft inner edge (7.75rem in
  # from the right of the viewport); 0 or less means it stops short of it.
  def stage_overlap
    page.evaluate_script(<<~JS)
      (() => {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const fadeEdge = document.querySelector('.kronk-frame__chrome').getBoundingClientRect().right - 7.75 * rem;
        return document.querySelector('.kronk-frame__stage').getBoundingClientRect().right - fadeEdge;
      })()
    JS
  end

  it 'keeps the Hub clear of the rail on a wide screen' do
    page.current_window.resize_to(1400, 900)
    visit '/hub'

    expect(page).to have_css('.kronk-frame__right-band .korner-sidebar')
    expect(page).to have_css('.kronk-stage')
    expect(stage_overlap).to be <= 0
  end

  it 'keeps the Hub clear of the rail just above the breakpoint, with a page scrollbar' do
    page.current_window.resize_to(900, 900)
    visit '/hub'
    expect(page).to have_css('.kronk-stage')

    # A classic page scrollbar makes the Frame narrower than the viewport.
    # The browser here hides scrollbars, so a gutter of the same width
    # stands in for one.
    page.execute_script("document.documentElement.style.paddingRight = '15px'")

    expect(page).to have_css('.kronk-frame__right-band .korner-sidebar')
    expect(stage_overlap).to be <= 0
  end
end
