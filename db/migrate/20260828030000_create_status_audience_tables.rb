# frozen_string_literal: true

# Per-post audience — the people layer (docs/rebuild/per_post_audience.md).
# Two join tables on top of the reach ladder, for the gated scopes only:
#   status_audience_grants     — people explicitly ADDED (can see it even
#                                though the reach tier wouldn't admit them)
#   status_audience_exclusions — people explicitly REMOVED (can't see it even
#                                though the reach tier would admit them)
# Public posts never carry rows here (they can't be restricted). id:false
# join tables with a unique pair index, mirroring statuses_krews.
class CreateStatusAudienceTables < ActiveRecord::Migration[8.0]
  def change
    create_table :status_audience_grants, id: false do |t|
      t.belongs_to :status, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.belongs_to :account, null: false, index: true, foreign_key: { on_delete: :cascade }
    end
    add_index :status_audience_grants, [:status_id, :account_id], unique: true, name: :index_status_audience_grants_uniq

    create_table :status_audience_exclusions, id: false do |t|
      t.belongs_to :status, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.belongs_to :account, null: false, index: true, foreign_key: { on_delete: :cascade }
    end
    add_index :status_audience_exclusions, [:status_id, :account_id], unique: true, name: :index_status_audience_exclusions_uniq
  end
end
