# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/huddle.md, The call follows you. The Jitsi script is replaced by
# a stand-in, so the test never joins the real Huddle.
RSpec.describe 'Huddle mini window', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:fake_jitsi) do
    <<~JS
      window.JitsiMeetExternalAPI = function (domain, options) {
        var call = document.createElement('div');
        call.className = 'fake-call';
        call.textContent = 'CALL';
        call.style.cssText = 'width:100%;height:100%;background:#222;color:#fff';
        options.parentNode.appendChild(call);
        window.__jitsiCommands = [];
      };
      window.JitsiMeetExternalAPI.prototype = {
        addListener: function () {},
        executeCommand: function (command) { window.__jitsiCommands.push(command); },
        getNumberOfParticipants: function () { return 2; },
        isAudioMuted: function () { return Promise.resolve(false); },
        isVideoMuted: function () { return Promise.resolve(false); },
        dispose: function () { window.__jitsiDisposed = true; },
      };
    JS
  end

  before do
    Capybara.current_session.driver.with_playwright_page do |pw|
      pw.route('**/external_api.js', lambda { |route, _request|
        route.fulfill(status: 200, contentType: 'application/javascript', body: fake_jitsi)
      })
      pw.route(%r{/room\?room=}, ->(route, _request) { route.fulfill(status: 200, contentType: 'application/json', body: '[]') })
      pw.route(%r{/room-size\?}, ->(route, _request) { route.fulfill(status: 200, contentType: 'application/json', body: '{"participants":0}') })
    end
    as_a_logged_in_user
  end

  it 'keeps the call in a floating window while you go elsewhere, and back' do
    visit '/huddle'
    click_on 'Huddle Up'
    expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

    visit_in_app('/home')

    expect(page).to have_css('.huddle-mini', text: '2 in the call')
    expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

    click_on 'Mute'
    expect(page.evaluate_script('window.__jitsiCommands')).to include('toggleAudio')

    click_on 'Back to the Huddle'
    expect(page).to have_no_css('.huddle-mini')
    expect(page).to have_button('Unhuddle')
    expect(page.evaluate_script('window.__jitsiDisposed')).to be_nil
  end

  it 'ends the call from the window' do
    visit '/huddle'
    click_on 'Huddle Up'
    expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

    visit_in_app('/home')
    within('.huddle-mini') { click_on 'Leave' }

    expect(page).to have_no_css('.huddle-mini')
    expect(page.evaluate_script('window.__jitsiDisposed')).to be true
  end

  # Moving inside the app, as a tap on a link does, without reloading it.
  def visit_in_app(path)
    page.execute_script("window.__kronkHistory ? window.__kronkHistory.push('#{path}') : document.querySelector('a[href=\"#{path}\"]').click()")
  end
end
