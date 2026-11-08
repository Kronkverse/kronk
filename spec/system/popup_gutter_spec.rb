# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Frame, Rules 6: nothing in a pop-up touches its edge.
RSpec.describe 'Pop-up gutter', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  [[390, 844], [1280, 900]].each do |w, h|
    it "keeps the invite message inside the pop-up's padding at #{w}px" do
      as_a_logged_in_user
      page.current_window.resize_to(w, h)
      visit '/me'
      click_on 'Invite'
      expect(page).to have_css('.invite-modal__message-input')

      gap = page.evaluate_script(<<~JS)
        (() => {
          const box = document.querySelector('.invite-modal__message-input').getBoundingClientRect();
          const panel = document.querySelector('.invite-modal').getBoundingClientRect();
          return [Math.round(box.left - panel.left), Math.round(panel.right - box.right)];
        })()
      JS
      expect(gap[1]).to be >= 12
      expect(gap[1]).to be_within(2).of(gap[0])
    end
  end
end
