# frozen_string_literal: true

# YOU's Kollection page, filled in (decisions.md, 2026-11-24): a tagline,
# what it is, who made it and the details, in plain words from Kashka's own
# README (Kashka-25/you-app-build, web-next). Only fields still blank are
# written, so nothing its keeper has set is overwritten; the description
# also replaces the one-line placeholder AddYouToKollection wrote. No pictures: they
# are uploads, which its keeper adds from the composer.
class FillInYouInKollection < ActiveRecord::Migration[8.1]
  class MigrationApp < ApplicationRecord
    self.table_name = 'kollection_apps'
  end

  PLACEHOLDER = "Your Own Universe: Kashka's app for your values, streaks, memories, mood and kosmic rhythms. " \
                'It is its own app in its own style, with its own sign-in for now.'

  DESCRIPTION = <<~TEXT.strip
    YOU, Your Own Universe, is a calm place to grow on purpose. Write in your journal (YOUrnal), keep track of habits, goals, dreams and ideas (PursYOUts), gather memories into chapters and seasons (YOUrney), and set out your values and Pillars. Extras are there if you want them, and it keeps working with no signal.

    YOU has its own sign-in for now, separate from Kronk.
  TEXT

  def up
    app = MigrationApp.find_by(slug: 'you', oauth_application_id: nil) || MigrationApp.find_by(name: 'YOU', oauth_application_id: nil)
    return if app.nil?

    fields = {
      tagline: 'A calm personal-growth app: your living biography.',
      description: DESCRIPTION,
      made_by: 'Kashka',
      category: 'wellbeing',
    }
    updates = fields.select { |column, _| app[column].blank? || (column == :description && app.description == PLACEHOLDER) }
    updates[:platforms] = %w(web) if app.platforms.blank?
    app.update_columns(updates) if updates.any?
  end

  def down
    # Nothing to undo: the fields stay as filled.
  end
end
