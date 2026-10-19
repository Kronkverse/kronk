# frozen_string_literal: true

require 'rails_helper'

# The viewer's arrows run through everyone's Moments, both ways
# (docs/spaces/moments.md, Viewer; Kommons "Fix arrow skip").
RSpec.describe 'Moments viewer arrows', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  def moment_of(account, ago)
    Moment.create!(account: account, media_attachment: Fabricate(:media_attachment, account: account), visibility: :public, created_at: ago)
  end

  it 'goes back to the previous person from the start of a stack, and on again' do
    as_a_logged_in_user
    ash = Fabricate(:account, username: 'ash')
    mine = moment_of(bob.account, 2.hours.ago)
    theirs = moment_of(ash, 1.hour.ago)

    visit "/hub/moments/#{theirs.id}"
    expect(page).to have_current_path("/hub/moments/#{theirs.id}")
    # The back arrow shows once the viewer knows there's someone before them.
    expect(page).to have_css('.moments-viewer__arrow--prev')

    find('body').send_keys(:left)
    expect(page).to have_current_path("/hub/moments/#{mine.id}")
    expect(page).to have_css('.moments-viewer__arrow--next')

    find('body').send_keys(:right)
    expect(page).to have_current_path("/hub/moments/#{theirs.id}")
  end
end
