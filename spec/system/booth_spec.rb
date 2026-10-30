# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md: who made a set. The artist is the uploader; others
# are credited by them, tagged accounts unverified until they confirm.
RSpec.describe 'Booth', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:ash)                 { Fabricate(:account, username: 'ash', display_name: 'Ash') }
  let(:set) do
    Fabricate(:booth_set, account: ash, title: 'Dawn at the point', artist_name: 'Ash & Maddog', published: true,
                          audio_attachment: Fabricate(:media_attachment, account: ash))
  end

  before do
    as_a_logged_in_user
    set.credits.create!(account: bob.account, position: 0)
    set.credits.create!(name: 'Lena K', position: 1)
    set.update!(artist_name: set.credit_line)
  end

  it 'lists artists as people, not as the lines typed on sets' do
    visit '/hub/booth/artists'

    expect(page).to have_css('.booth-artist-chip', count: 3)
    expect(page).to have_css('.booth-artist-chip', text: 'Ash')
    expect(page).to have_css('.booth-artist-chip', text: 'Lena K')

    find('.booth-artist-chip', text: 'Ash').click
    expect(page).to have_current_path('/hub/booth/artists/%40ash')
    expect(page).to have_content('Dawn at the point')
  end

  it 'shows a tagged person as unverified until they say it is them' do
    visit "/hub/booth/sets/#{set.id}"

    expect(page).to have_css('.booth-credit', text: '@ash')
    expect(page).to have_css('.booth-credit', text: /@#{bob.account.username}\s*unverified/)
    expect(page).to have_css('.booth-credit', text: 'Lena K')

    click_on "That\u2019s me"
    expect(page).to have_no_content('unverified')
    expect(set.credits.find_by(account: bob.account)).to be_verified

    click_on 'Take me off'
    expect(page).to have_no_css('.booth-credit', text: "@#{bob.account.username}")
    expect(set.reload.artist_name).to eq 'Ash & Lena K'
  end

  it 'credits people from the edit form: a tagged account and a plain name' do
    mine = Fabricate(:booth_set, account: bob.account, title: 'Low tide', published: true,
                                 audio_attachment: Fabricate(:media_attachment, account: bob.account))
    ash

    visit "/hub/booth/sets/#{mine.id}"
    find('.kronk-menu__trigger').click
    click_on 'Edit set'

    fill_in placeholder: 'Search Kronk, or type a name', with: 'ash'
    within('.booth-credits__found') { click_on 'Ash' }
    fill_in placeholder: 'Search Kronk, or type a name', with: 'Lena K'
    click_on "Add \u201CLena K\u201D as a name (not on Kronk)"
    click_on 'Save changes'

    expect(page).to have_css('.booth-credit', text: /@ash\s*unverified/)
    expect(page).to have_css('.booth-credit', text: 'Lena K')
    expect(mine.reload.credits.map(&:label)).to eq ['Ash', 'Lena K']
  end

  # docs/spaces/booth.md, The room: a host in the room missed Go live in the
  # header's row of small actions, so it has its own panel at the top.
  it 'gives the host of a planned set Go live on its own, not in the header' do
    live = Fabricate(:booth_live, account: bob.account)

    visit "/hub/booth/live/#{live.id}"

    within('.booth-live__go') do
      expect(page).to have_content('Nobody can listen in until you go live.')
      expect(page).to have_button('Go live')
    end
    expect(page).to have_no_css('.korner-detail__actions button', text: 'Go live')
  end

  # docs/spaces/booth.md, Going live: Go live is a big button on the Live
  # view, not a text link (Tal's proposal "'Go live' button").
  it 'offers Go live as a button on the Live view' do
    visit '/hub/booth/live'

    expect(page).to have_content('Nothing live right now')
    click_on 'Go live'

    expect(page).to have_current_path('/hub/booth/composer/live')
  end

  # docs/spaces/booth.md, Musik: View lays the sets out in rows, one per
  # artist or one per kind (Tal's proposal "Music arranging").
  it 'lays Musik out in rows by artist and by kind' do
    row = ->(title) { find('.booth-shelf__title', exact_text: title).ancestor('.booth-shelf') }
    Fabricate(:booth_set, account: ash, title: 'Second wind', kind: 'live_recording', published: true,
                          audio_attachment: Fabricate(:media_attachment, account: ash))

    visit '/hub/booth'
    click_on 'View: Grid'
    click_on 'By artist'

    within(row.call('Lena K')) do
      expect(page).to have_css('.space-grid--row')
      expect(page).to have_content('Dawn at the point')
      expect(page).to have_no_content('Second wind')
    end

    click_on 'View: By artist'
    click_on 'By kind'
    within(row.call('Live recordings')) do
      expect(page).to have_content('Second wind')
      click_on 'See all'
    end
    expect(page).to have_button('Kind: Live recording')
  end

  # docs/spaces/booth.md, Albums.
  describe 'albums' do
    it 'lists an album\'s tracks on its page, in order' do
      album = BoothSet.new(account: ash, title: 'Tides', artist_name: 'Ash', kind: 'album', published: true)
      %w(Ebb Flow).each_with_index do |name, i|
        album.tracks.build(audio_attachment: Fabricate(:media_attachment, account: ash), title: name, position: i, duration_seconds: 60)
      end
      album.save!

      visit "/hub/booth/sets/#{album.id}"

      expect(page).to have_css('.booth-album .booth-tracklist__title', count: 2)
      expect(page.all('.booth-album .booth-tracklist__title').map(&:text)).to eq %w(Ebb Flow)
    end

    it 'uploads an album from several files, one track each' do
      visit '/hub/booth/composer'

      click_on 'Album or EP'
      find('.booth-album-field input[type="file"]', visible: :all)
        .set([file_fixture('boop.mp3').to_s, file_fixture('boop.ogg').to_s])
      expect(page).to have_css('.booth-album-field__track', count: 2)
      find('[aria-label="Title of track 2"]').set('Boop again')
      find('[aria-label="Title"]').set('Two boops')
      click_on 'Upload set'

      expect(page).to have_current_path(%r{\A/hub/booth/sets/\d+})
      album = BoothSet.find_by!(title: 'Two boops')
      expect(album.kind).to eq 'album'
      expect(album.tracks.map(&:title)).to eq ['boop', 'Boop again']
    end
  end
end
