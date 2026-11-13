# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/moments.md, Filters (Tal, 2026-11-12): a Filter button on a
# photo; the photo shows each filter as you swipe across it or step with
# the arrows, with its name and what it does.
RSpec.describe 'Moment filters', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it 'tries filters on a photo by stepping and swiping', :aggregate_failures do
    pick_photo
    expect(page).to have_no_css('.moments-composer__filter')

    click_on 'Filter'
    expect(page).to have_css('.moments-composer__filter-name', text: 'Original')
    expect(page).to have_css('.moments-composer__filter-line', text: 'As you took it')
    find('[aria-label="Next filter"]').click
    expect(page).to have_css('.moments-composer__filter-name', text: 'Banksia')
    expect(page).to have_css('.moments-composer__filter-line', text: 'Warm and soft')

    # A swipe right goes back a filter.
    swipe_right_on('.moments-composer__hero')
    expect(page).to have_css('.moments-composer__filter-name', text: 'Original')

    click_on 'Done'
    expect(page).to have_no_css('.moments-composer__filter')
    expect(page).to have_button('Filter')
  end

  def pick_photo
    ignore_js_error(/Failed to load resource/)
    page.current_window.resize_to(390, 844)
    visit '/hub/moments/composer'
    find('input[type=file][multiple]', visible: :all).attach_file(Rails.root.join('spec', 'fixtures', 'files', 'attachment.jpg'))
  end

  def swipe_right_on(selector)
    box = find(selector).native.bounding_box
    page.driver.with_playwright_page do |pw|
      y = box['y'] + 150
      pw.mouse.move(box['x'] + 60, y)
      pw.mouse.down
      pw.mouse.move(box['x'] + 250, y, steps: 5)
      pw.mouse.up
    end
  end
end
