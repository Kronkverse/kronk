# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-23: any creation Konnects to any other. A composer
# holds its Konnections until what it makes exists (hooks/useKonnect.ts),
# shown in the Konnect row <ComposeShell> draws, and Konnects them once the
# create succeeds.
RSpec.describe 'Konnecting from a composer', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:album) { Album.create!(owner: bob.account, title: 'Studio days', visibility: :public) }

  before { as_a_logged_in_user }

  it 'Konnects a new art piece to an album picked in the Konnect row' do
    album
    visit '/hub/art/composer'

    within('.compose-shell') do
      find('.art-composer__title').set('Blue study')
      within('.konnect-row') { click_on 'Konnect' }
    end
    within('.attachment-picker') do
      click_on 'Albutts'
      click_on 'Studio days'
    end

    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: 'Studio days')
      click_on 'Post piece'
    end

    expect(page).to have_no_css('.compose-shell')
    piece = ArtPiece.find_by!(title: 'Blue study')
    expect(KornerAttachment.where(source_slug: 'art', source_id: piece.id, target_slug: 'albutts', target_id: album.id, kind: 'link')).to exist
  end

  it 'opens on the record it was made from, which can be dropped' do
    visit "/hub/art/composer?konnect=albutts:#{album.id}"

    within('.konnect-row') do
      expect(page).to have_css('.space-tile', text: 'Studio days')
      click_on 'Diskonnect Studio days'
      expect(page).to have_no_css('.space-tile', text: 'Studio days')
    end
  end
end
