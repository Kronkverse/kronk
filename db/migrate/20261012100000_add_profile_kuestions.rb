# frozen_string_literal: true

# Profile Kuestions: Kuestions people answer and pin to their profile,
# replacing profile Fields (docs/spaces/kuestions.md (Profile Kuestions)).
#
# - questions.kind: `community` (the Deck) or `profile`.
# - questions.seed_key: the stable key of a Kronk-written profile Kuestion
#   (config/kuestions_profile_seeds.yml). Seeded Kuestions have no author,
#   so created_by_account_id becomes nullable.
# - answers.pinned_at / pin_position / settings: an answer pinned to its
#   author's profile, its place in their order, and its tile size.
# - answers.visibility_scope's default was still the pre-ladder
#   `connections`, which the model rejects; it becomes `mates`.
class AddProfileKuestions < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_column :questions, :kind, :string, default: 'community', null: false
      add_column :questions, :seed_key, :string
      change_column_null :questions, :created_by_account_id, true

      add_column :answers, :pinned_at, :datetime
      add_column :answers, :pin_position, :integer
      add_column :answers, :settings, :jsonb, default: {}, null: false
      change_column_default :answers, :visibility_scope, from: 'connections', to: 'mates'
    end

    add_index :questions, :seed_key, unique: true, where: 'seed_key IS NOT NULL', algorithm: :concurrently
    add_index :questions, :kind, where: "kind <> 'community'", algorithm: :concurrently
    add_index :answers, [:account_id, :pin_position], where: 'pinned_at IS NOT NULL', algorithm: :concurrently
  end
end
