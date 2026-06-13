# frozen_string_literal: true

# On shadow.kronk.info: auto-confirm pending accounts so email delivery is not required.
# This file is harmless on production (LOCAL_DOMAIN won't match).
if ENV['LOCAL_DOMAIN'] == 'shadow.kronk.info'
  Rails.application.config.after_initialize do
    Rails.application.executor.wrap do
      User.where(confirmed_at: nil).or(User.where(approved: false)).find_each do |u|
        u.skip_confirmation!
        u.approved = true
        u.save!(validate: false)
      rescue => e
        Rails.logger.warn("shadow_account_setup: could not confirm #{u.email}: #{e.message}")
      end
    end
  rescue => e
    Rails.logger.warn("shadow_account_setup error: #{e.message}")
  end
end
