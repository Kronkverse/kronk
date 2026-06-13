# frozen_string_literal: true

class ApproveShadowAccounts < ActiveRecord::Migration[8.0]
  def up
    return unless ENV['LOCAL_DOMAIN'] == 'shadow.kronk.info'

    User.where(approved: false).or(User.where(confirmed_at: nil)).find_each do |u|
      u.confirmed_at ||= Time.now.utc
      u.approved = true
      u.save!(validate: false)
    end
  end

  def down; end
end
