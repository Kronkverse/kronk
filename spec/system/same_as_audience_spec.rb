# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-25, "Konnections carry audience: Same as": a record
# Konnected to another can take its audience and follow it. The composer's
# Who sees this offers "Same as <title>" (hooks/useSameAs.ts), every
# Konnected tile says who sees its record, and a record's page can start or
# stop following (components/attachment_section.tsx).
RSpec.describe 'Same as: Konnections carrying audience', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:member)   { Fabricate(:account, username: 'fern') }
  let(:stranger) { Fabricate(:account, username: 'reed') }
  let(:growers) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current).tap do |krew|
      krew.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      krew.krew_memberships.create!(account: member, role: 'member', source: 'direct')
    end
  end

  before { as_a_logged_in_user }

  # An event made within Growers, as the events API posts one: its post is
  # for Growers alone, and the Krew is Konnected to it.
  def growers_event(title = 'Harvest dinner')
    event = Event.create!(account: bob.account, title: title, start_time: 2.days.from_now, end_time: 2.days.from_now + 3.hours)
    status = PostStatusService.new.call(bob.account, text: title, visibility: 'self_only', krew_ids: [growers.id])
    event.update!(status: status)
    status.update_column(:source_korner, 'kalendar')
    Kronk::EventLinks.posted(event, bob.account)
    event
  end

  def link(source, source_slug, target, target_slug)
    KornerAttachment.create!(source_slug: source_slug, source_id: source.id, target_slug: target_slug, target_id: target.id,
                             kind: 'link', created_by_account: bob.account)
  end

  def pick_in_picker(korner, title)
    within('.attachment-picker') do
      click_on korner
      click_on title
    end
  end

  def reach_menu(&block)
    find('.reach-dropdown__button').click
    within('.reach-dropdown__menu', &block)
  end

  def expect_growers_only(record)
    expect(Kronk::Audience.read(record.reload)).to eq(tier: 'self_only', krew_ids: [growers.id])
    expect(record.visible_to?(member)).to be(true)
    expect(record.visible_to?(stranger)).to be(false)
  end

  def expect_following(slug, record, event)
    row = KornerAttachment.find_by!(source_slug: slug, source_id: record.id, target_slug: 'kalendar', target_id: event.id)
    expect(row.metadata).to include('audience_follows' => 'target')
  end

  it "makes an album from a Growers event's Konnect picker, Same as the event by default" do
    event = growers_event
    visit "/hub/kalendar/#{event.id}"
    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') do
      click_on 'Albutts'
      click_on 'New album'
    end

    within('.compose-shell') do
      expect(page).to have_css('.reach-dropdown__button', text: 'Same as the Harvest dinner event')
      expect(page).to have_css('.konnect-row .space-tile--leads', text: /Harvest dinner.*Growers.*Same as/m)
      reach_menu { expect(page).to have_css('.reach-dropdown__same[aria-selected="true"]', text: /Harvest dinner.*Growers/m) }
      find('input[placeholder="What is this album?"]').set('Harvest photos')
      click_on 'Create album'
    end
    # With no photos to add, the composer goes on to the album.
    expect(page).to have_css('.attachment-section .konnected-card--leads', text: /Harvest dinner.*Growers.*Same as/m)

    album = Album.find_by!(title: 'Harvest photos')
    expect_growers_only(album)
    expect_following('albutts', album, event)
    visit "/hub/kalendar/#{event.id}"
    expect(page).to have_css('.attachment-section .space-tile', text: /Harvest photos.*Growers/m)
  end

  it 'gives a film the Growers audience when Same as is chosen' do
    event = growers_event
    visit '/hub/cinema/composer'

    within('.compose-shell') do
      # Reach chosen by hand first, so Same as is a choice, not the default.
      reach_menu { find('.reach-dropdown__item', text: 'Mates').click }
      find('input[placeholder="Title"]').set('Harvest reel')
      within('.konnect-row') { click_on 'Konnect' }
    end
    pick_in_picker('Kalendar', 'Harvest dinner')

    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: /Harvest dinner.*Growers/m)
      reach_menu { find('.reach-dropdown__same', text: 'Same as the Harvest dinner event').click }
      expect(page).to have_css('.reach-dropdown__button', text: 'Same as the Harvest dinner event')
      attach_file(file_fixture('voice.mp4'), make_visible: true)
      click_on 'Post film'
    end

    expect(page).to have_no_css('.compose-shell')
    film = Film.find_by!(title: 'Harvest reel')
    expect_growers_only(film)
    expect_following('cinema', film, event)
  end

  it "stops following from the album's page, keeping the audience it has" do
    event = growers_event
    album = Album.create!(owner: bob.account, title: 'Harvest photos', visibility: :public)
    row = link(album, 'albutts', event, 'kalendar')
    Kronk::Audience.follow!(row, 'source')
    visit "/hub/albutts/albums/#{album.id}"

    card = find('.attachment-section .konnected-cards > li', text: 'Harvest dinner')
    expect(card).to have_css('.konnected-card--leads', text: /Growers.*Same as/m)
    card.click_on 'Stop following the Harvest dinner event'
    click_on 'Yes'

    expect(page).to have_no_css('.attachment-section .konnected-card--leads')
    expect(page).to have_css('.attachment-section .konnected-card', text: /Harvest dinner.*Growers/m)
    expect(row.reload.metadata.to_h).to_not have_key('audience_follows')
    expect_growers_only(album)
  end

  it "says when a Konnected event's Krew can't open the album, and mends it" do
    event = growers_event
    album = Album.create!(owner: bob.account, title: 'Harvest photos', visibility: :self_only)
    link(album, 'albutts', event, 'kalendar')
    visit "/hub/albutts/albums/#{album.id}"

    expect(page).to have_css('.attachment-section__note', text: 'Growers can’t open the Harvest photos album.')
    click_on 'Make it Same as the Harvest dinner event'
    click_on 'Yes'

    expect(page).to have_no_css('.attachment-section__note')
    expect(page).to have_css('.attachment-section .konnected-card--leads', text: 'Harvest dinner')
    expect_growers_only(album)
  end

  it 'shows a Konnected Booth set as seen by Everyone, and never offers to follow it' do
    ash = Fabricate(:account, username: 'ash')
    set = Fabricate(:booth_set, account: ash, title: 'Dawn at the point', artist_name: 'Ash', published: true,
                                audio_attachment: Fabricate(:media_attachment, account: ash))
    visit "/hub/art/composer?konnect=booth:#{set.id}"

    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: /Dawn at the point.*Everyone/m)
      expect(page).to have_no_css('.konnect-row .space-tile--leads')
      reach_menu do
        expect(page).to have_css('.reach-dropdown__item', text: 'Kronkverse')
        expect(page).to have_no_css('.reach-dropdown__same')
      end
    end
  end
end
