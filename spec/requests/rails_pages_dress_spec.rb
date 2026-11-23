# frozen_string_literal: true

require 'rails_helper'

# The Rails-served settings and admin pages wear the app's dress: the
# top-left back pill, the app's five pillars, no Invite button, and no
# "Back to Kronk" sidebar item (docs/design.md 4.3).
RSpec.describe 'Rails pages in Kronk dress' do
  let(:user) { Fabricate(:user) }

  describe 'a member settings page' do
    before { sign_in user }

    it 'backs out to Settings with the app pill and draws the app chrome', :aggregate_failures do
      get filters_path

      expect(response).to have_http_status(200)
      page = Nokogiri::HTML(response.body)
      expect(page.css('.kronk-rails-stage a.space-badge[href="/settings"]').text).to include('Settings')
      expect(page.css('.hub-switcher--top .hub-switcher__pillar').pluck('href'))
        .to eq %w(/me /home /awawb /hub /nudges)
      expect(page.css('.hub-switcher--bottom .hub-switcher__item').size).to eq 5
      expect(page.css('.kronk-invite-button')).to be_empty
      expect(page.css('.kronk-settings-nav a').map(&:text).join).to_not include(I18n.t('settings.back'))
    end
  end

  describe 'an admin page' do
    before do
      user.update!(role: UserRole.find_by!(name: 'Owner'))
      sign_in user
    end

    it 'backs out to Kronk' do
      get admin_reports_path

      page = Nokogiri::HTML(response.body)
      expect(page.css('.kronk-rails-stage a.space-badge[href="/"]').text).to include('Kronk')
    end
  end

  describe 'sign-in' do
    it 'pins the dark skin, on the starfield' do
      get new_user_session_path

      expect(Nokogiri::HTML(response.body).at_css('body')['class'].split)
        .to include('theme-default')
        .and not_include('theme-system')
    end
  end
end
