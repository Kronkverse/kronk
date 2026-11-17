# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Samples: share a sample, find it, download a free
# one, ask for an ask-first one, and credit one on a set.
RSpec.describe 'Booth samples', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:ash)                 { Fabricate(:account, username: 'ash', display_name: 'Ash') }
  let(:events)              { [] }

  before do
    as_a_logged_in_user
    allow(Kronk::KornerEvents).to receive(:publish).and_wrap_original do |original, name, **payload|
      events << [name, payload]
      original.call(name, **payload)
    end
  end

  # Processing on, so the server reads the file's type and length.
  it 'shares a sample from the composer and finds it under Samples', :attachment_processing do
    visit '/hub/booth/composer/sample'

    find('.booth-album-field input[type="file"]', visible: :all).set(file_fixture('boop.mp3').to_s)
    expect(page).to have_field('Name it', with: 'boop')
    fill_in 'Name it', with: 'Boop vocal'
    select 'Vocal', from: 'What is it?'
    fill_in 'Key (optional)', with: 'C major'
    fill_in 'BPM (optional)', with: '120'
    click_on 'Ask first'
    click_on 'Share', exact: true

    expect(page).to have_current_path(%r{\A/hub/booth/samples/\d+\z})
    sample = BoothSample.find_by!(title: 'Boop vocal')
    expect(sample).to have_attributes(sample_type: 'vocal', musical_key: 'C major', bpm: 120, terms: 'ask', account: bob.account)
    expect(page).to have_css('.korner-detail', text: /Vocal.*120 BPM.*C major/m)

    visit '/hub/booth/samples'
    expect(page).to have_css('.booth-samples__grid .space-card', text: /Boop vocal.*Ask first/im)
  end

  it 'offers Download on a free sample and narrows by type' do
    Fabricate(:booth_sample, account: ash, title: 'Dusty break', sample_type: 'beat')
    Fabricate(:booth_sample, account: ash, title: 'Hum', sample_type: 'vocal')

    visit '/hub/booth/samples'
    within('.booth-samples__types') { click_on 'Beat' }
    expect(page).to have_no_content('Hum')

    click_on 'Dusty break'
    expect(page).to have_content(/Free with credit/i)
    expect(page).to have_button('Download')
    expect(page).to have_content('List it under Samples used')
  end

  it 'asks first, and downloads once the maker says yes' do
    sample = Fabricate(:booth_sample, account: ash, title: 'Secret hook', terms: 'ask')

    visit "/hub/booth/samples/#{sample.id}"
    expect(page).to have_button('Ask to use')
    expect(page).to have_no_button('Download')
    click_on 'Ask to use'

    expect(page).to have_button('Asked', disabled: true)
    expect(page).to have_content('You asked. Ash will say yes or no.')
    expect(events).to include(['booth.sample.asked', { actor_account_id: bob.account.id, recipient_account_id: ash.id, booth_sample_id: sample.id }])

    sample.requests.find_by!(account: bob.account).update!(state: 'yes')
    visit "/hub/booth/samples/#{sample.id}"
    expect(page).to have_button('Download')
    expect(page).to have_content('Ash said yes.')
  end

  it 'lets the maker answer a request on the sample’s page' do
    sample = Fabricate(:booth_sample, account: bob.account, title: 'My hook', terms: 'ask')
    request = sample.requests.create!(account: ash)

    visit "/hub/booth/samples/#{sample.id}"
    within('.booth-sample-request', text: 'Ash') { click_on 'Yes' }

    expect(page).to have_content('You said yes')
    expect(request.reload.state).to eq 'yes'
    expect(events).to include(['booth.sample.granted', { actor_account_id: bob.account.id, recipient_account_id: ash.id, booth_sample_id: sample.id }])
  end

  it 'credits a sample under Samples used and tells its maker' do
    sample = Fabricate(:booth_sample, account: ash, title: 'Dusty break')
    mine = Fabricate(:booth_set, account: bob.account, title: 'Low tide', published: true,
                                 audio_attachment: Fabricate(:media_attachment, account: bob.account))

    visit "/hub/booth/sets/#{mine.id}"
    find('.kronk-menu__trigger').click
    click_on 'Edit set'
    fill_in placeholder: 'Search samples you can use', with: 'Dusty'
    within('.booth-samples-used .booth-credits__found') { click_on 'Dusty break' }
    click_on 'Save changes'

    within('.booth-sample-used-in') do
      expect(page).to have_link('Dusty break', href: "/hub/booth/samples/#{sample.id}")
      expect(page).to have_content('by Ash')
    end
    expect(mine.reload.samples).to eq [sample]
    expect(events).to include(['booth.sample.used', { actor_account_id: bob.account.id, recipient_account_id: ash.id, booth_set_id: mine.id, booth_sample_id: sample.id }])

    visit "/hub/booth/samples/#{sample.id}"
    within('.booth-set__section', text: /Used in/i) { expect(page).to have_link('Low tide') }
  end
end
