# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/feed.md: a korner post on its own page, and commenting under a post.
RSpec.describe 'Feed posts', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:listing)             { Listing.create!(account: bob.account, title: 'Red bike', category: 'goods', state: 'live') }

  before do
    as_a_logged_in_user
    Wachuneed::PublishListing.new(listing).call
  end

  it 'draws a korner post as its card on the post page, as the feed does' do
    visit "/@#{bob.account.username}/#{listing.reload.status_id}"

    within('.status__wrapper') do
      expect(page).to have_css('.status-wachuneed-card', text: 'Red bike')
      expect(page).to have_no_css('.status__content')
    end
  end

  describe 'a comment\'s own address' do
    let(:post)    { PostStatusService.new.call(bob.account, text: 'Who has a ladder?') }
    let(:comment) { PostStatusService.new.call(bob.account, text: 'Mine is bent', thread: post) }
    let(:answer)  { PostStatusService.new.call(bob.account, text: 'Mine is fine', thread: comment) }

    # A comment's avatar is the default one on the test domain, which doesn't answer.
    before { ignore_js_error(/Failed to load resource: the server responded with a status of 404/) }

    it 'opens the post it was on, with the comment picked out' do
      visit "/@#{bob.account.username}/#{comment.id}"

      expect(page).to have_current_path("/@#{bob.account.username}/#{post.id}?comment=#{comment.id}")
      within('.status__wrapper') { expect(page).to have_content('Who has a ladder?') }
      expect(page).to have_css('.status-replies__item--highlighted', text: 'Mine is bent')
    end

    it 'opens a comment on a comment with its branch open' do
      visit "/@#{bob.account.username}/#{answer.id}"

      expect(page).to have_current_path("/@#{bob.account.username}/#{post.id}?comment=#{answer.id}")
      expect(page).to have_css('.status-replies__item--highlighted', text: 'Mine is fine')
    end

    it 'says so when the post is gone, and shows no comment' do
      comment
      post.discard

      visit "/@#{bob.account.username}/#{comment.id}"

      expect(page).to have_content('The post this comment was on is gone.')
      expect(page).to have_no_content('Mine is bent')
    end
  end

  it 'posts a comment as written, without tagging the person answered' do
    # The home feed asks the Huddle server how full the room is; there is none here.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
    visit '/home'

    within('.status-wachuneed-card') { expect(page).to have_content('Red bike') }
    fill_in 'Write a reply...', with: 'Still going?'
    find('textarea[placeholder="Write a reply..."]').send_keys(:enter)

    expect(page).to have_css('.status-replies__item', text: 'Still going?')
    expect(Status.where(in_reply_to_id: listing.reload.status_id).pick(:text)).to eq 'Still going?'
  end

  # The draft used to outlive a composer emptied by hand, and came back,
  # attachments and reply target included, the next time it opened.
  it 'forgets the saved draft once the composer is emptied' do
    visit '/publish'

    box = find('textarea.autosuggest-textarea__textarea')
    box.fill_in with: 'Half a thought'
    wait_until { Draft.exists?(account: bob.account) }

    box.fill_in with: ''
    wait_until { !Draft.exists?(account: bob.account) }

    expect(Draft.where(account: bob.account)).to be_empty
  end

  def wait_until(seconds = 10)
    deadline = Time.zone.now + seconds
    sleep 0.2 until yield || Time.zone.now > deadline
    expect(yield).to be_truthy
  end
end
