# frozen_string_literal: true

# ToS versioning + interstitial retired. Kronk's terms live at
# /kronk/terms as git-versioned markdown (`content/kronk/terms.md`),
# not in the database. Instance operators fork and edit the file per
# their deployment rather than distributing versions through the
# admin UI.
#
# Drops:
#   - `terms_of_service` table (was a small versioned-copy log — a
#     handful of published records at most on any instance)
#   - `users.require_tos_interstitial` (the flag that forced a signed-in
#     user through the interstitial after a ToS distribution; now that
#     there are no distributions, the flag is inert)
#
# Data loss on this migration is intentional and safe: policy copy
# lives in the repo, and no downstream code reads
# `require_tos_interstitial` any more (see the retirement of
# `WebAppControllerConcern#redirect_to_tos_interstitial!`).
class RetireTermsOfService < ActiveRecord::Migration[8.0]
  # `safety_assured` blocks required by `strong_migrations`:
  #   - `remove_column` on a live table with a nullable column is flagged
  #     because a stale AR schema cache on an old process could try to
  #     write to the column between the migration and the code reload.
  #     Kronk's shadow + production deploys are single-instance restarts
  #     (see /home/shared/infra.md — `deploy-staging.sh` migrates then
  #     restarts the Rails process in one shot), so there is no rolling
  #     window; the code that referenced this column is already gone.
  #   - `drop_table` is flagged for the same reason. Same rationale.
  # The code side of the retirement (User model / serializer / worker)
  # already merged in #1102; this migration is just DB cleanup.
  def up
    safety_assured { remove_column :users, :require_tos_interstitial } if column_exists?(:users, :require_tos_interstitial)
    safety_assured { drop_table :terms_of_services } if table_exists?(:terms_of_services)
  end

  def down
    unless table_exists?(:terms_of_services)
      create_table :terms_of_services do |t|
        t.text :text
        t.datetime :published_at
        t.datetime :notification_sent_at
        t.date :effective_date
        t.timestamps
      end
      add_index :terms_of_services, :effective_date, unique: true, where: 'effective_date IS NOT NULL'
    end

    add_column :users, :require_tos_interstitial, :boolean, default: false, null: false unless column_exists?(:users, :require_tos_interstitial)
  end
end
