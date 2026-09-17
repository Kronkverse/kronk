# frozen_string_literal: true

# Account-level profile privacy (the reach ladder applied to the whole
# /@user profile). 0 = public (Kronkverse), the default — "everyone is
# present in Kronk". Owners can narrow to mates / orbit / self_only.
# Values match the ProfileVisibility ladder (public:0, mates:1, orbit:3,
# self_only:4) so the profile speaks the same reach vocabulary as its cards.
class AddProfileVisibilityToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :profile_visibility, :integer, default: 0, null: false
  end
end
