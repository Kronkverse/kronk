# frozen_string_literal: true

class ResetOriginalSynPassword < ActiveRecord::Migration[8.0]
  def up
    return unless ENV['LOCAL_DOMAIN'] == 'shadow.kronk.info'

    u = User.joins(:account).where(accounts: { username: 'original_syn' }).first
    return unless u

    u.password = 'Shadow1234'
    u.password_confirmation = 'Shadow1234'
    u.confirmed_at ||= Time.now.utc
    u.approved = true
    u.save!(validate: false)
  end

  def down; end
end
