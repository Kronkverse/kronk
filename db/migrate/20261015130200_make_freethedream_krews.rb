# frozen_string_literal: true

# Every emergence already seeded gets its Krew, with everyone in it as a
# member. Safe to re-run: Project#ensure_krew! does nothing once there is
# one.
class MakeFreethedreamKrews < ActiveRecord::Migration[8.0]
  def up
    Freethedream::Project.reset_column_information
    Freethedream::Project.top_level.find_each(&:ensure_krew!)
  end

  def down
    # The Krews may have chat and posts by now; leave them.
  end
end
