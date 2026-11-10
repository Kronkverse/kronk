# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-11-08, "Posts: no … menu; Repost is back".
RSpec.describe 'Post bar and Repost', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before { as_a_logged_in_user }

  it 'reposts a post with a comment, the original embedded in it' do
    ana = Fabricate(:account, username: 'ana')
    original = PostStatusService.new.call(ana, text: 'Spring doof on the hill', visibility: 'public')

    visit "/@ana/#{original.id}"
    within('.status__action-bar', match: :first) do
      expect(page).to have_no_button('More')
      click_on 'Repost'
    end

    expect(page).to have_current_path('/publish')
    fill_in frontend_translations('compose_form.placeholder'), with: 'Who is coming?'
    click_on frontend_translations('compose_form.publish')

    expect(page).to have_no_current_path('/publish')
    repost = Status.find_by(text: 'Who is coming?')
    expect(repost.quote.quoted_status).to eq original

    visit "/@#{bob.account.username}/#{repost.id}"
    expect(page).to have_content('Who is coming?')
    expect(page).to have_content('Spring doof on the hill')
  end

  it 'deletes your own post from Edit, after asking' do
    post = PostStatusService.new.call(bob.account, text: 'Gone soon', visibility: 'public')

    visit "/@#{bob.account.username}/#{post.id}"
    # On a post's own page Edit is in the Ж menu; Delete is inside Edit.
    find('.kronk-menu__trigger').click
    click_on 'Edit post'

    within('.edit-indicator') { click_on 'Delete' }
    within('.confirm-dialog__panel') { click_on 'Delete' }

    expect(page).to have_current_path('/home')
    deadline = Time.zone.now + 10
    sleep 0.2 while Status.exists?(id: post.id) && Time.zone.now < deadline
    expect(Status.exists?(id: post.id)).to be false
  end

  it "shows a post's froths on its own page, and who frothed it" do
    ana = Fabricate(:account, username: 'ana')
    cleo = Fabricate(:account, username: 'cleo', display_name: 'Cleo')
    post = PostStatusService.new.call(ana, text: 'Doof at dusk', visibility: 'public')
    FavouriteService.new.call(cleo, post)

    visit "/@ana/#{post.id}"
    within('.status__action-bar', match: :first) do
      find('.status__action-bar__froths', text: '1').click
    end

    expect(page).to have_current_path("/@ana/#{post.id}/favourites")
    expect(page).to have_content('Cleo')
  end
end
