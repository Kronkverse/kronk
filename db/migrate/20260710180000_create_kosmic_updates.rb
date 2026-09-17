# frozen_string_literal: true

# InFlow ships a daily Kosmic Update per Tal's 2026-07-10 decision.
# A scheduled Sidekiq job creates one row per day, projects it to a
# Status for feed presence, and the framework's tune-in gate ensures
# it appears only for users tuned in to InFlow.
class CreateKosmicUpdates < ActiveRecord::Migration[8.0]
  def change
    create_table :kosmic_updates do |t|
      t.date       :on_date, null: false                                     # the day this update is for (UTC)
      t.text       :body,    null: false
      t.jsonb      :seasonal_context, default: {}, null: false               # sun/moon phase, hemisphere hint, etc.
      t.bigint     :status_id                                                # §5.5 canonical linkage
      t.datetime   :published_at

      t.timestamps
    end

    add_index :kosmic_updates, :on_date, unique: true
    add_index :kosmic_updates, :status_id, unique: true, where: 'status_id IS NOT NULL'
    add_index :kosmic_updates, :published_at, where: 'published_at IS NOT NULL'
  end
end
