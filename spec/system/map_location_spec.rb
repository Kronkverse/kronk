# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md, Your location: Share and Update from Anthemos, top left.
RSpec.describe 'Map location button', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:ana)                 { Fabricate(:account, username: 'ana', display_name: 'Ana') }

  def link_phone!
    key = Base64.strict_encode64(OpenSSL::PKey::EC.generate('prime256v1').public_to_der)
    AnthemosLink.create!(account: bob.account, public_key: key, device_name: 'Pixel 8')
  end

  before { as_a_logged_in_user }

  it 'is not there until a phone is linked' do
    visit '/hub/map'

    expect(page).to have_css('.map-mates__canvas')
    expect(page).to have_no_button('Your location')
    expect(page).to have_no_button('Near me')
  end

  it 'opens Share and Update, and stops a share running now' do
    bob.account.follow!(ana)
    ana.follow!(bob.account)
    share = LiveShare.create!(account: bob.account, anthemos_link: link_phone!, recipient_account_ids: [ana.id], expires_at: 1.hour.from_now)

    visit '/hub/map'
    click_on 'Your location'

    expect(page).to have_button(text: 'Share')
    expect(page).to have_button(text: 'Update')
    expect(page).to have_css('.map-location__share', text: 'Sharing with Ana')

    within('.map-location__share') { click_on 'Stop' }

    expect(page).to have_no_css('.map-location__share')
    expect(LiveShare.exists?(share.id)).to be false
  end

  it 'says it comes from the phone when used on a computer' do
    link_phone!
    visit '/hub/map'
    click_on 'Your location'
    click_on 'Update'

    expect(page).to have_text('This comes from Anthemos on your phone')
  end
end
