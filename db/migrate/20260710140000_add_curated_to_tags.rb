# frozen_string_literal: true

# Kategories reuse Mastodon's hashtag infrastructure. A `curated:` flag
# marks the ~20 default kategories Kronk ships (`music`, `essays`,
# `politics`, etc.) — see config/kategory_defaults.yaml.
#
# Uncurated tags remain regular hashtags. Feed filters and profile
# section suggestions read the curated set; user-created tags are still
# free to become popular and, over time, get curated by governance.
class AddCuratedToTags < ActiveRecord::Migration[8.0]
  def change
    add_column :tags, :curated, :boolean, default: false, null: false
    add_index :tags, :curated, where: 'curated = true'
  end
end
