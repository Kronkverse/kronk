# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kronikles.md: pictures between the paragraphs of a Kronikle.
RSpec.describe 'Kronikles', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    # The test server does not serve the uploaded files themselves.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'reads a picture where the body places it, with its caption' do
    picture = Fabricate(:media_attachment, account: bob.account, type: :image)
    piece = Chronicle.create!(owner: bob.account, title: 'Low tide', kind: :essay, visibility: :public,
                              body: "## Morning\n\nThe water was glass.\n\n![The point at dawn](picture:#{picture.id})\n\nThen the wind came.")

    visit "/hub/kronikles/#{piece.id}"

    expect(page).to have_css('.kronikles-markdown h2', text: 'Morning')
    expect(page).to have_css(".kronikles-markdown__figure img[alt='The point at dawn']")
    expect(page).to have_css('.kronikles-markdown__figure figcaption', text: 'The point at dawn')
    expect(page).to have_no_content('picture:')
  end

  it 'adds a heading and a picture from the writing aids, and publishes them' do
    visit '/hub/kronikles/composer'

    fill_in 'Title', with: 'Low tide'
    click_on 'Heading'
    find('.kronikles-composer__file', visible: :all).set(Rails.root.join('spec', 'fixtures', 'files', 'attachment.jpg').to_s)

    # The thumbnail first: it is what says the upload has landed, and only
    # then has the picture's line been written into the body.
    expect(page).to have_css('.kronikles-composer__pictures img')
    body = find('.kronikles-composer__body')
    expect(body.value).to match(/\A## \n\n!\[\]\(picture:\d+\)/)

    body.send_keys('The water was glass.')
    click_on 'Publish'

    expect(page).to have_css('.kronikles-markdown__figure img')
    expect(Chronicle.last.pictures.count).to eq 1
  end

  # docs/spaces/kronikles.md, Series.
  it 'reads a Series chapter by chapter, and opens its contents' do
    series = ChronicleSeries.create!(owner: bob.account, title: 'The long walk')
    first = Chronicle.create!(owner: bob.account, title: 'Setting out', kind: :short_story, visibility: :public, body: 'We left at dawn.', series: series)
    Chronicle.create!(owner: bob.account, title: 'The river', kind: :short_story, visibility: :public, body: 'Cold water.', series: series)

    visit "/hub/kronikles/#{first.id}"

    expect(page).to have_content('Chapter 1 of 2')
    click_on 'Next chapter'
    expect(page).to have_css('.kronikles-reader__title', text: 'The river')
    expect(page).to have_content('Chapter 2 of 2')

    click_on 'Contents'
    expect(page).to have_css('.korner-detail__title', text: 'The long walk')
    expect(page).to have_css('.kronikles-series__chapter', count: 2)
    expect(page).to have_css('.kronikles-series__chapter:first-child .kronikles-series__title', text: 'Setting out')
  end

  it 'shows a Series once in the directory' do
    series = ChronicleSeries.create!(owner: bob.account, title: 'The long walk')
    Chronicle.create!(owner: bob.account, title: 'Setting out', kind: :short_story, visibility: :public, body: 'We left at dawn.', series: series)
    Chronicle.create!(owner: bob.account, title: 'The river', kind: :short_story, visibility: :public, body: 'Cold water.', series: series)

    visit '/hub/kronikles'

    expect(page).to have_css('.kronikles-card--series', count: 1, text: 'The long walk')
    expect(page).to have_no_css('.kronikles-card__title', text: 'Setting out')
  end
end
