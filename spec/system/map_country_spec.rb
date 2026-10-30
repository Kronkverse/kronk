# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md: First Nations Country. A profile's "On <name> Country"
# opens that Country on the Map.
RSpec.describe 'Map Country', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:ana) { Fabricate(:user, account: Fabricate(:account, username: 'ana', first_nations_country: 'Mardu')).account }

  before do
    as_a_logged_in_user
    bob.account.follow!(ana)
    ana.follow!(bob.account)
  end

  it 'opens the Country from a profile' do
    visit '/@ana'
    page.execute_script(<<~JS)
      window.__errors = [];
      const original = console.error;
      console.error = (...args) => {
        window.__errors.push(args.map((a) => (a && a.stack) || String(a)).join(' '));
        original(...args);
      };
      window.addEventListener('error', (e) => window.__errors.push(String(e.error && e.error.stack || e.message)));
    JS

    click_on 'On Mardu Country'

    expect(page).to have_css('.map-country__card', text: 'Mardu Country')
  ensure
    errors = page.evaluate_script('window.__errors') if page.has_css?('.error-boundary', wait: 0)
    warn "COUNTRY CRASH:\n#{Array(errors).join("\n---\n")}" if errors
  end
end
