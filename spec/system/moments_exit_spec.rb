# frozen_string_literal: true

require 'rails_helper'

# The viewer's way out has to be seen and reached on a phone: an iPhone
# home-screen app has no Back button (docs/spaces/moments.md, Viewer,
# Getting out; Kommons "Make a way to exit Moments").
RSpec.describe 'Moments viewer exit', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  it 'shows a close button on a phone, above the tab bar, that closes the viewer' do
    as_a_logged_in_user
    ash = Fabricate(:account, username: 'ash')
    moment = Moment.create!(account: ash, media_attachment: Fabricate(:media_attachment, account: ash), visibility: :public, caption: 'Low tide')

    page.current_window.resize_to(390, 664)
    visit '/hub/moments'
    visit "/hub/moments/#{moment.id}"
    expect(page).to have_css('.moments-viewer__close')
    expect(page).to have_css('.moments-viewer__caption', text: 'Low tide')

    found = page.evaluate_script(<<~JS)
      (() => {
        const close = document.querySelector('.moments-viewer__close');
        const box = close.getBoundingClientRect();
        const atClose = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        const actions = document.querySelector('.moments-viewer__actions');
        actions.scrollIntoView({ block: 'nearest' });
        const footer = actions.getBoundingClientRect();
        const atFooter = document.elementFromPoint(footer.x + footer.width / 2, footer.y + footer.height / 2);
        return {
          onScreen: box.top >= 0 && box.bottom <= innerHeight && box.right <= innerWidth,
          size: [box.width, box.height],
          closeOnTop: close.contains(atClose),
          footerOnTop: !!atFooter && !!atFooter.closest('.moments-viewer'),
          iconFill: getComputedStyle(close.querySelector('svg')).fill,
          iconColour: getComputedStyle(close).color,
        };
      })()
    JS

    expect(found['onScreen']).to be true
    expect(found['size']).to eq([44, 44])
    expect(found['closeOnTop']).to be true
    expect(found['footerOnTop']).to be true
    expect(found['iconFill']).to eq(found['iconColour'])

    find('.moments-viewer__close').click
    expect(page).to have_no_css('.moments-viewer')
    expect(page).to have_current_path('/hub/moments')
  end
end
