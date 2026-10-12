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
end
