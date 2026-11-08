# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kuestions.md, Kuestions in a Krew; decisions.md 2026-11-08:
# Kuestions is a space a Krew turns on, and its Ask is a small composer.
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

  def turn_on_kuestions
    krew.krew_korners.create!(korner: 'kuestions')
  end

  it 'turns Kuestions on from Konnect, with Ask first', :aggregate_failures do
    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') { click_on 'Kuestions' }

    within('.krew-detail__kuestions') do
      expect(page).to have_css('.space-grid__cell:last-child .home-kuestions__card--ask', text: 'Ask')
    end
    within('.attachment-section') { expect(page).to have_button('Kuestions') }
    expect(page).to have_no_css('.attachment-picker')
    expect(krew.krew_korners.pluck(:korner)).to include('kuestions')
  end

  it 'asks one in its own small composer', :aggregate_failures do
    turn_on_kuestions

    visit "/hub/krew/#{krew.slug}"
    find('.home-kuestions__card--ask').click

    expect(page).to have_text('Only the Krew’s members see it and answer it.')
    expect(page).to have_no_text('Where does it go?')
    expect(page).to have_no_button('Next')
    first('textarea').fill_in(with: 'Which weekend for the harvest?')
    within('.compose-shell') { click_on 'Ask' }

    expect(page).to have_current_path("/hub/krew/#{krew.slug}")
    within('.krew-detail__kuestions') { expect(page).to have_css('.home-kuestions__card', text: 'Which weekend for the harvest?') }
    expect(Question.find_by(title: 'Which weekend for the harvest?')).to have_attributes(krew_id: krew.id, status_id: nil)
  end

  it 'lists its Kuestions and answers one in place', :aggregate_failures do
    turn_on_kuestions
    Question.create!(title: 'Who brings the generator?', created_by_account: asker, krew: krew, locked: true)

    visit "/hub/krew/#{krew.slug}"

    within('.krew-detail__kuestions') do
      expect(page).to have_css('.home-kuestions__card', text: 'Who brings the generator?')
      find('.home-kuestions__card', text: 'Who brings the generator?').click
    end

    find('.kuestions-sheet__text').fill_in(with: 'I will')
    click_on 'Answer & unlock'
    expect(page).to have_text('I will')
    click_on 'Next kuestion'

    within('.krew-detail__kuestions') { expect(page).to have_css('.home-kuestions__card', text: 'Answered') }
  end

  it 'shows no section while Kuestions is off, even with Kuestions in it' do
    Question.create!(title: 'Who brings the generator?', created_by_account: asker, krew: krew, locked: true)

    visit "/hub/krew/#{krew.slug}"

    expect(page).to have_css('.attachment-section')
    expect(page).to have_no_css('.krew-detail__kuestions')
  end

  # Tal, 2026-11-08: whoever asked a Kuestion can delete it.
  it 'deletes a Kuestion you asked, after asking first', :aggregate_failures do
    turn_on_kuestions
    Question.create!(title: 'Who brings the generator?', created_by_account: bob.account, krew: krew, locked: true)

    visit "/hub/krew/#{krew.slug}"
    within('.krew-detail__kuestions') { find('.home-kuestions__card', text: 'Who brings the generator?').click }
    click_on 'Delete Kuestion'
    within('.confirm-dialog__panel') { click_on 'Delete' }

    within('.krew-detail__kuestions') { expect(page).to have_no_css('.home-kuestions__card', text: 'Who brings the generator?') }
    expect(Question.find_by(title: 'Who brings the generator?')).to be_nil
  end
end
