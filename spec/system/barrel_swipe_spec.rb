# frozen_string_literal: true

require 'rails_helper'

# The barrel turns under the finger: a sideways swipe on a space turns it to
# its next view, a short drag springs back, an up-and-down drag is the page's
# scroll, and the title band turns on a swipe of its own
# (components/feed_drum.tsx, components/scope_title.tsx).
RSpec.describe 'Swiping the barrel', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    page.current_window.resize_to(390, 800)
    visit '/home'
    # The feed has loaded (an empty one, for a new member), so a touch lands
    # on it and not on whatever the page showed while loading.
    find('.feed-drum .empty-column-indicator')
  end

  def title
    find('.scope-title .space-header__title').text
  end

  def point_in(selector, y_offset)
    page.evaluate_script(<<~JS)
      (() => {
        const r = document.querySelector(#{selector.to_json}).getBoundingClientRect();
        return [Math.round(r.left + r.width / 2), Math.round(r.top + #{y_offset})];
      })()
    JS
  end

  # A touch from `from` moved by `across`, `down` in `steps` moves, then
  # lifted (or, with `lift: false`, held where it ended).
  def swipe(from, across:, down: 0, steps: 8, lift: true)
    page.driver.with_playwright_page do |pw|
      cdp = pw.context.new_cdp_session(pw)
      x, y = from
      touch = ->(type, px, py) { cdp.send_message('Input.dispatchTouchEvent', params: { type: type, touchPoints: type == 'touchEnd' ? [] : [{ x: px, y: py }] }) }
      touch.call('touchStart', x, y)
      (1..steps).each { |i| touch.call('touchMove', x + (across * i / steps), y + (down * i / steps)) }
      yield touch if block_given?
      touch.call('touchEnd', x + across, y + down) if lift
    end
  end

  def at_rest
    expect(page).to have_no_css('.feed-drum__overlay')
  end

  it 'turns to the next view on a swipe left, and back on a swipe right' do
    first = title
    swipe(point_in('.feed-drum', 60), across: -200)
    expect(page).to have_no_css('.scope-title .space-header__title', exact_text: first)
    at_rest

    swipe(point_in('.feed-drum', 60), across: 200)
    expect(page).to have_css('.scope-title .space-header__title', exact_text: first)
    at_rest
  end

  it 'turns under the finger, and springs back when it comes back' do
    first = title
    from = point_in('.feed-drum', 60)
    swipe(from, across: -90, lift: false) do |touch|
      turned = page.evaluate_script("document.querySelector('.feed-drum__cube')?.style.transform")
      expect(turned).to match(/rotateY\(-\d+(\.\d+)?deg\)/)
      touch.call('touchMove', from[0] - 5, from[1])
      touch.call('touchMove', from[0], from[1])
      touch.call('touchEnd', from[0], from[1])
    end
    at_rest
    expect(title).to eq first
  end

  it 'springs back from a short drag' do
    first = title
    swipe(point_in('.feed-drum', 60), across: -14, steps: 2)
    at_rest
    expect(title).to eq first
  end

  it 'leaves an up-and-down drag alone' do
    first = title
    swipe(point_in('.feed-drum', 60), across: -60, down: 120)
    at_rest
    expect(title).to eq first
  end

  it 'turns on a swipe across the title band' do
    first = title
    swipe(point_in('.scope-title', 20), across: -120)
    expect(page).to have_no_css('.scope-title .space-header__title', exact_text: first)
  end
end
