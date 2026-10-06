# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Home page' do
  context 'when signed in' do
    before { sign_in Fabricate(:user) }

    it 'visits the homepage and renders the web app' do
      visit root_path

      expect(page)
        .to have_css('noscript', text: /Kronk/)
        .and have_css('body', class: 'app-body')
    end
  end

  # Signed-out `/` is Kronk's server-rendered landing (sign-in form),
  # not the SPA — see HomeController#index. Mastodon's
  # `Setting.landing_page` (about / trends / local feed) only steered the
  # signed-out SPA, so it no longer has any effect on `/`.
  context 'when not signed in' do
    it 'renders the sign-in landing' do
      visit root_path

      expect(page)
        .to have_title(I18n.t('auth.login'))
        .and have_field('user_email')
        .and have_field('user_password')
        .and have_button(I18n.t('auth.login'))
    end

    context 'when the landing page setting points somewhere else' do
      before { Setting.landing_page = 'trends' }

      it 'stays on the landing, with no browser errors', :js, :streaming do
        visit root_path

        expect(page)
          .to have_current_path('/')
          .and have_field('user_email')
      end
    end
  end
end
