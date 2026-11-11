# frozen_string_literal: true

require 'rails_helper'

# Kommons "Video playing upon scroll" (2026-11-08): the floating player
# (a video that keeps playing as you scroll past it) sat under the korner
# rail. It keeps to the Stage: clear of the right band, over the content.
RSpec.describe 'The floating player', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  # The player's own box, placed by the stylesheet: what matters here is
  # where the page's CSS puts it, not the video inside.
  def player_box
    page.evaluate_script(<<~JS)
      (() => {
        const el = document.createElement('div');
        el.className = 'picture-in-picture';
        el.style.height = '200px';
        document.body.appendChild(el);
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const box = el.getBoundingClientRect();
        return { right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight, rem: rem,
                 z: Number(getComputedStyle(el).zIndex) };
      })()
    JS
  end

  it 'stays clear of the korner rail on a wide screen' do
    page.current_window.resize_to(935, 985)
    visit '/home'
    expect(page).to have_css('.kronk-frame__right-band')

    box = player_box
    expect(box['right']).to be <= box['width'] - (7.75 * box['rem'])
    expect(box['z']).to be > 25
  end
end
