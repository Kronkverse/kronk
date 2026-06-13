# frozen_string_literal: true

class ResetShadowAdmin < ActiveRecord::Migration[8.0]
  def up
    return unless ENV['LOCAL_DOMAIN'] == 'shadow.kronk.info'

    owner_role = UserRole.find_by(name: 'Owner')
    admin = User.where(role: owner_role).first if owner_role
    admin ||= User.order(:id).first

    return unless admin

    admin.password = 'Kronk1234!'
    admin.password_confirmation = 'Kronk1234!'
    admin.confirmed_at ||= Time.now.utc
    admin.save!(validate: false)

    User.where(confirmed_at: nil).find_each do |u|
      u.confirmed_at = Time.now.utc
      u.save!(validate: false)
    end
  end

  def down; end
end
