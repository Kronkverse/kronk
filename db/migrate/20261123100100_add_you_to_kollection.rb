# frozen_string_literal: true

# YOU folds into Kollection (decisions.md, 2026-11-23). It was a korner of
# its own, a portal page at /hub/you leading to Kashka's app; it is now one
# entry in Kollection, a link with no Kronk sign-in yet (it has its own).
# No keeper: an admin assigns one from the admin page. The text is what
# config/korners/you.yaml said, and the address is the one it linked to.
class AddYouToKollection < ActiveRecord::Migration[8.1]
  class KollectionApp < ApplicationRecord
    self.table_name = 'kollection_apps'
  end

  def up
    return if KollectionApp.exists?(name: 'YOU')

    KollectionApp.create!(
      name: 'YOU',
      description: "Your Own Universe: Kashka's app for your values, streaks, memories, mood and kosmic rhythms. " \
                   'It is its own app in its own style, with its own sign-in for now.',
      website: 'https://you.kronk.info'
    )
  end

  def down
    KollectionApp.where(name: 'YOU', oauth_application_id: nil).delete_all
  end
end
