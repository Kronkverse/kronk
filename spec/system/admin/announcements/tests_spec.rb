# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin Announcement Tests' do
  let(:user) { Fabricate(:admin_user) }
  let(:announcement) { Fabricate(:announcement, notification_sent_at: nil) }

  before { sign_in(user) }

  describe 'Sending test Announcement email', :inline_jobs do
    it 'generates the test email' do
      visit admin_announcement_preview_path(announcement)
      expect(page)
        .to have_title(I18n.t('admin.announcements.preview.title'))

      # The Send-preview button is still labelled with an
      # `admin.terms_of_service.*` locale key — inherited from upstream
      # Mastodon reusing the ToS preview UI for announcements. The
      # locale entries are untouched by this PR (locale cleanup is a
      # follow-up), so the key still resolves.
      emails = capture_emails { click_on I18n.t('admin.terms_of_service.preview.send_preview', email: user.email) }
      expect(emails.first)
        .to be_present
        .and(deliver_to(user.email))
      expect(page)
        .to have_title(I18n.t('admin.announcements.title'))
    end
  end
end
