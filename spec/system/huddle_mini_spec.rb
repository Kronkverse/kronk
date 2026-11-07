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
        window.__jitsiOptions = options;
        window.__jitsiListeners = {};
        window.__jitsiEmit = function (event, data) {
          (window.__jitsiListeners[event] || []).forEach(function (listener) { listener(data); });
        };
      };
      window.JitsiMeetExternalAPI.prototype = {
        addListener: function (event, listener) {
          (window.__jitsiListeners[event] = window.__jitsiListeners[event] || []).push(listener);
        },
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

  # docs/decisions.md, 2026-10-27: Jitsi's toolbar is hidden and Kronk's
  # controls drive the call.
  it 'drives the call from Kronk’s own controls, with the toolbar hidden', :aggregate_failures do
    visit '/huddle'
    click_on 'Huddle Up'
    expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

    expect(page.evaluate_script('window.__jitsiOptions.configOverwrite.toolbarButtons')).to eq []
    expect(page.evaluate_script('window.__jitsiOptions.roomName')).to eq 'huddle'

    click_on 'Raise hand'
    click_on 'Show everyone'
    click_on 'Turn camera off'
    expect(page.evaluate_script('window.__jitsiCommands')).to include('toggleRaiseHand', 'toggleTileView', 'toggleVideo')

    # No tokens in the test environment, so no Record button for anyone.
    expect(page).to have_no_button('Record')

    page.execute_script("window.__jitsiEmit('audioMuteStatusChanged', { muted: true })")
    expect(page).to have_button('Unmute')

    page.execute_script("window.__jitsiEmit('recordingStatusChanged', { on: true, mode: 'file' })")
    expect(page).to have_css('.call-controls__recording', text: 'Recording')

    # The state goes with the call into the mini window.
    visit_in_app('/home')
    within('.huddle-mini') do
      expect(page).to have_button('Unmute')
      expect(page).to have_text('Recording')
    end
  end

  # A Kuddle's call follows you too (Tal's proposal "Navigating away from a
  # huddle"): the window goes by the Kuddle's name and back to its page.
  context 'with a Kuddle' do
    let(:kuddle) { HuddleRoom::CreateService.new.call(account: bob.account, name: 'Ember') }

    it 'keeps its call in the floating window, named for it, and goes back to it' do
      visit "/hub/huddle/kuddle/#{kuddle.id}"
      expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

      visit_in_app('/home')

      within('.huddle-mini') do
        expect(page).to have_css('.huddle-mini__title', text: 'Ember')
        expect(page).to have_text('2 in the call')
      end
      expect(page.evaluate_script('window.__jitsiDisposed')).to be_nil

      click_on 'Back to the Huddle'
      expect(page).to have_current_path("/hub/huddle/kuddle/#{kuddle.id}")
      expect(page).to have_no_css('.huddle-mini')
      expect(page).to have_button('Unhuddle')
      expect(page).to have_css('.huddle-call .fake-call', visible: :visible)
      expect(page.evaluate_script('window.__jitsiDisposed')).to be_nil
    end

    it "leaves a Kuddle's call in the window on the Main Huddle's page" do
      visit "/hub/huddle/kuddle/#{kuddle.id}"
      expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

      visit_in_app('/hub/huddle')

      expect(page).to have_css('.huddle-mini .huddle-mini__title', text: 'Ember')
      expect(page).to have_button('Huddle Up')
    end

    # docs/spaces/huddle.md, A frame in a projekt: a Kuddle Konnected to a
    # projekt is a call frame on its page, not a tile, and its call follows
    # you back to the projekt.
    it 'shows a Konnected Kuddle as a frame in the projekt, and its call comes back there' do
      doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
      KornerAttachment.create!(source_slug: 'freethedream', source_id: doof.id, target_slug: 'huddle', target_id: kuddle.id, kind: 'link', created_by_account: bob.account)
      projekt = "/hub/krew/#{doof.reload.krew.slug}/p/#{doof.slug}"

      visit projekt
      within('.kuddle-frame') do
        expect(page).to have_link('Ember')
        click_on 'Join the call'
      end
      expect(page).to have_css('.huddle-call .fake-call', visible: :visible)
      expect(page).to have_no_css('.attachment-section .space-tile', text: 'Ember')

      visit_in_app('/home')
      within('.huddle-mini') { expect(page).to have_css('.huddle-mini__title', text: 'Ember') }

      click_on 'Back to the Huddle'
      expect(page).to have_current_path(projekt)
      within('.kuddle-frame') { expect(page).to have_button('Unhuddle') }
      expect(page.evaluate_script('window.__jitsiDisposed')).to be_nil
    end

    it 'shows a Kuddle Konnected to a Krew as a frame on the Krew page' do
      krew = Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current)
      krew.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      KornerAttachment.create!(source_slug: 'krew', source_id: krew.id, target_slug: 'huddle', target_id: kuddle.id, kind: 'link', created_by_account: bob.account)

      visit "/hub/krew/#{krew.slug}"
      within('.kuddle-frame') do
        expect(page).to have_link('Ember')
        click_on 'Join the call'
      end
      expect(page).to have_css('.huddle-call .fake-call', visible: :visible)
      expect(page).to have_no_css('.attachment-section .space-tile', text: 'Ember')
    end

    it "ends the Main Huddle's call on joining a Kuddle: one call at a time" do
      visit '/huddle'
      click_on 'Huddle Up'
      expect(page).to have_css('.huddle-call .fake-call', visible: :visible)

      visit_in_app("/hub/huddle/kuddle/#{kuddle.id}")

      expect(page).to have_button('Unhuddle')
      expect(page).to have_no_css('.huddle-mini')
      expect(page).to have_css('.huddle-call', count: 1, visible: :all)
      expect(page.evaluate_script('window.__jitsiDisposed')).to be true
    end
  end

  # Moving inside the app, as a tap on a link does, without reloading it:
  # a link to the page if there is one, else the router's own history.
  def visit_in_app(path)
    page.execute_script(<<~JS)
      var link = document.querySelector('a[href="#{path}"]');
      if (link) { link.click(); } else {
        window.history.pushState({}, '', '#{path}');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    JS
  end
end
