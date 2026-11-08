# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kuestions.md, Kuestions in a Krew; decisions.md 2026-11-08.
RSpec.describe 'Kuestions in a Krew', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:asker) { Fabricate(:account, username: 'ash') }
  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      k.krew_memberships.create!(account: asker, role: 'member', source: 'direct')
    end
  end

  before { as_a_logged_in_user }

  it 'lists its Kuestions with Ask last, and answers one in place', :aggregate_failures do
    Question.create!(title: 'Who brings the generator?', created_by_account: asker, krew: krew, locked: true)

    visit "/hub/krew/#{krew.slug}"

    within('.attachment-section') { expect(page).to have_button('Kuestions') }
    within('.krew-detail__kuestions') do
      expect(page).to have_css('.home-kuestions__card', text: 'Who brings the generator?')
      expect(page).to have_css('.space-grid__cell:last-child .home-kuestions__card--ask', text: 'Ask')
      find('.home-kuestions__card', text: 'Who brings the generator?').click
    end

    find('.kuestions-sheet__text').fill_in(with: 'I will')
    click_on 'Answer & unlock'
    expect(page).to have_text('I will')
    click_on 'Next kuestion'

    within('.krew-detail__kuestions') { expect(page).to have_css('.home-kuestions__card', text: 'Answered') }
  end

  it 'asks a new one in the Krew from the Ask card', :aggregate_failures do
    Question.create!(title: 'Who brings the generator?', created_by_account: asker, krew: krew, locked: true)

    visit "/hub/krew/#{krew.slug}"
    find('.home-kuestions__card--ask').click

    first('textarea').fill_in(with: 'Which weekend for the harvest?')
    click_on 'Next'
    expect(page).to have_text('Asked in Growers. Only its members see it.')
    expect(page).to have_no_text('Where does it go?')
    click_on 'Ask'

    expect(page).to have_current_path("/hub/krew/#{krew.slug}")
    within('.krew-detail__kuestions') { expect(page).to have_css('.home-kuestions__card', text: 'Which weekend for the harvest?') }
    expect(Question.find_by(title: 'Which weekend for the harvest?')).to have_attributes(krew_id: krew.id, status_id: nil)
  end

  it 'shows no section while the Krew has none' do
    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.attachment-section')
    expect(page).to have_no_css('.krew-detail__kuestions')
  end
end
