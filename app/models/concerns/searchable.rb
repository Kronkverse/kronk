# frozen_string_literal: true

# Searchable — mix into any ActiveRecord model that should surface in
# Kronk Search. Declares the model's index type and (optionally) a
# guard that gates writes (curated tags only, discoverable groups
# only, etc.). Documents are built via `#as_json_for_search`, which
# each model can override.
#
#   class Status < ApplicationRecord
#     include Searchable
#     searchable_as :statuses
#
#     def as_json_for_search
#       { id: id, text: text, spoiler_text: spoiler_text, ... }
#     end
#   end
#
#   class Tag < ApplicationRecord
#     include Searchable
#     searchable_as :kategories, if: :curated?
#   end
#
# On create/update, `sync_to_search_index` fires and pushes the
# document. On destroy, `remove_from_search_index` sends a delete.
# The adapter (`Kronk::Search.adapter`) chooses whether to hit
# Meilisearch or no-op. Callbacks run after commit so a rolled-back
# transaction doesn't leave orphan documents behind.

module Searchable
  extend ActiveSupport::Concern

  class_methods do
    def searchable_as(type, if: nil)
      class_attribute :search_index_type, instance_writer: false, default: type.to_sym
      class_attribute :search_index_condition, instance_writer: false, default: binding.local_variable_get(:if)

      # One `after_commit` covering both create and update, NOT a
      # separate `after_create_commit` + `after_update_commit`.
      #
      # Those two are both sugar for `after_commit ..., on:`, and
      # registering the same method name twice does not give you two
      # callbacks — the later registration replaces the earlier one.
      # Written the obvious way, only `on: :update` survived, so a
      # record was indexed when it was *edited* and never when it was
      # *created*. Search looked healthy because the reindex task
      # backfilled whatever already existed; everything posted after
      # that was simply absent until someone happened to edit it.
      after_commit :sync_to_search_index, on: [:create, :update]
      after_commit :remove_from_search_index, on: :destroy
    end
  end

  def sync_to_search_index
    return unless satisfies_search_condition?

    Kronk::Search.adapter.index(self.class.search_index_type, self)
  end

  def remove_from_search_index
    Kronk::Search.adapter.remove(self.class.search_index_type, self)
  end

  # Default document: id only. Models override to declare their
  # searchable fields per the spec §"Object types indexed" table.
  def as_json_for_search
    { id: id }
  end

  private

  def satisfies_search_condition?
    cond = self.class.search_index_condition
    return true if cond.nil?
    return send(cond) if cond.is_a?(Symbol)

    instance_exec(&cond)
  end
end
