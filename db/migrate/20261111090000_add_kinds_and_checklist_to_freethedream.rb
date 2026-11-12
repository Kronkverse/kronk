# frozen_string_literal: true

# A projekt's kind (Gathering, Creation, Build, …), which suggests its
# Komponents, and a tick for a checklist entry (Tal, 2026-11-10,
# "Projekts and Krew work"). docs/spaces/freethedream.md, Kinds and the
# checklist.
class AddKindsAndChecklistToFreethedream < ActiveRecord::Migration[8.1]
  def change
    add_column :freethedream_projects, :kind, :integer
    add_column :freethedream_items, :done_at, :datetime
  end
end
