# frozen_string_literal: true

# Kuestions v2 rebuild (Phase 1b — Answer visibility scopes).
#
# Prototype dial has 5 positions: `everyone`, `kronk_members`,
# `connections`, `vouched`, `only_me`. `everyone` is the widest —
# non-local viewers included (federation surface); `only_me` a
# self-note. `vouched` sits between `connections` and `only_me` and
# awaits the vouching model — until then it is enforcement-equivalent
# to `connections` (a per-account gate) so answers already posted
# under it remain private-enough.
class AddVisibilityScopeToAnswers < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :answers, :visibility_scope, :string, null: false, default: 'connections'
    end
  end
end
