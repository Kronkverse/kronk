# frozen_string_literal: true

# YOU's Kollection entry linked to https://you.kronk.info, an address that
# was planned but never set up (no DNS record). Kashka's app is live on
# Netlify. Only an entry still on the dead address is changed, so one an
# admin or keeper has already corrected is left alone.
class PointYouAtItsLiveAddress < ActiveRecord::Migration[8.1]
  class KollectionApp < ApplicationRecord
    self.table_name = 'kollection_apps'
  end

  DEAD = 'https://you.kronk.info'
  LIVE = 'https://you-app-build.netlify.app/'

  def up
    KollectionApp.where(name: 'YOU', website: DEAD).update_all(website: LIVE)
  end

  def down
    KollectionApp.where(name: 'YOU', website: LIVE).update_all(website: DEAD)
  end
end
