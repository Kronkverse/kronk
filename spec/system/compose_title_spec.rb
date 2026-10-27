# frozen_string_literal: true

require 'rails_helper'

# Korner Standard L13: the composer's title is boxed like every other field,
# in the display serif (decisions.md, 2026-10-27, "The composer title is a
# text box").
RSpec.describe 'Composer title', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  it 'is drawn in the same box as the other fields, in the serif' do
    as_a_logged_in_user
    visit '/hub/albutts/composer'
    expect(page).to have_css('.compose-shell .compose-title')
    expect(page).to have_css('.compose-shell .compose-input')

    looks = page.evaluate_script(<<~JS)
      (() => {
        const look = (el) => {
          const s = getComputedStyle(el);
          return {
            border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderLeftWidth + ' ' + s.borderLeftStyle,
            radius: s.borderTopLeftRadius,
            background: s.backgroundColor,
            font: s.fontFamily,
          };
        };
        return {
          title: look(document.querySelector('.compose-shell .compose-title')),
          field: look(document.querySelector('.compose-shell .compose-input')),
        };
      })()
    JS

    expect(looks['title'].except('font')).to eq(looks['field'].except('font'))
    expect(looks['title']['border']).to eq('1px solid 1px solid')
    expect(looks['title']['font']).to_not eq(looks['field']['font'])
  end
end
