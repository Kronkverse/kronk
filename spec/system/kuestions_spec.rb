# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kuestions.md: the reveal sheet.
RSpec.describe 'Kuestions', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    question = Question.create!(title: 'Tea or coffee?', created_by_account: Fabricate(:account, username: 'ana'))
    Answer.create!(question: question, account: bob.account, body: 'Tea, always.')
  end

  it 'opens the answers over the whole screen, no wider than it' do
    page.current_window.resize_to(390, 800)
    visit '/hub/kuestions/answered'

    find('.kuestions-answered__open', text: 'Tea or coffee?').click

    # In <body>, not inside the page's turning drum, so it is laid out
    # against the screen.
    expect(page).to have_css('body > .kuestions-sheet-wrap .kuestions-sheet', text: 'Tea or coffee?')
    overflow = page.evaluate_script("document.querySelector('.kuestions-sheet').getBoundingClientRect().right - window.innerWidth")
    expect(overflow).to be <= 0
    expect(page).to have_no_css('.kuestions-stars')
  end

  # Tal, 2026-11-12: a Kuestion's link opens it to answer, not to an empty
  # reveal, and it can be shared from there.
  it "opens a Kuestion's link to answer it, then shows the answers", :aggregate_failures do
    asked = Question.create!(title: 'Best swim spot?', created_by_account: Fabricate(:account, username: 'cal'))
    Answer.create!(question: asked, account: Fabricate(:account, username: 'dee'), body: 'The point')
    visit "/hub/kuestions/#{asked.id}"

    within('.kuestions-sheet') do
      expect(page).to have_css('.kuestions-sheet__q', text: 'Best swim spot?')
      expect(page).to have_no_text('The point')
      click_on 'Share'
    end
    expect(page).to have_css('.share-sheet', text: 'Best swim spot?')
    find('.share-sheet__panel').send_keys(:escape)
    expect(page).to have_no_css('.share-sheet')

    within('.kuestions-sheet') do
      find('.kuestions-sheet__text').set('Under the bridge')
      click_on 'Answer & unlock'
    end
    within('.kuestions-sheet') do
      expect(page).to have_text('The point')
      expect(page).to have_text('Under the bridge')
    end
  end
end
