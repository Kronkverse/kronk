# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Share page', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  # A share intent (`?text=`) opens Mastodon's share page; a bare /share
  # is Kronk's Share section since 2.2.0 (docs/decisions.md, 2026-11-01).
  it 'allows posting a new status' do
    visit share_path(text: 'Shared from elsewhere')

    expect(page)
      .to have_css('.modal-layout')
      .and have_css('div#mastodon-compose')
      .and have_css('.compose-form__submit')

    fill_in_form

    expect(page)
      .to have_current_path(%r{/@bob/[0-9]+})
  end

  def fill_in_form
    within('.compose-form') do
      fill_in frontend_translations('compose_form.placeholder'),
              with: 'This is a new status!'
      click_on frontend_translations('compose_form.publish')
    end
  end
end
