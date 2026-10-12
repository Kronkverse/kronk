# frozen_string_literal: true

# FreeTheDream — a project, or a part of one (docs/spaces/freethedream.md,
# "The mechanism"). Parts nest to any depth under a top-level project, the
# root. Membership lives on the root and covers every part in it.
#
# Whoever made a project or part owns it. Nobody else can change or remove
# it, but if its owner leaves (or their account goes) anyone in the project
# can take it over.
module Freethedream
  class Project < ApplicationRecord
    self.table_name = 'freethedream_projects'

    TITLE_MAX = 120
    DESCRIPTION_MAX = 5000

    belongs_to :parent, class_name: 'Freethedream::Project', optional: true
    belongs_to :root, class_name: 'Freethedream::Project', optional: true
    belongs_to :owner, class_name: 'Account', optional: true
    belongs_to :source_idea, class_name: 'Freethedream::Item', optional: true

    has_many :children, class_name: 'Freethedream::Project', foreign_key: :parent_id, inverse_of: :parent, dependent: nil
    has_many :memberships, class_name: 'Freethedream::Membership', dependent: nil
    has_many :placements, class_name: 'Freethedream::Placement', dependent: nil
    has_many :items, through: :placements
    has_many :dependencies, class_name: 'Freethedream::Dependency', dependent: nil
    has_many :depends_on, through: :dependencies, source: :depends_on
    has_many :dependent_links, class_name: 'Freethedream::Dependency', foreign_key: :depends_on_id, inverse_of: :depends_on, dependent: nil
    has_many :needed_by, through: :dependent_links, source: :project
    has_many :comments, class_name: 'Freethedream::Comment', as: :subject, dependent: :delete_all

    enum :joining, { open: 0, by_request: 1 }, suffix: :joining, validate: true

    validates :title, presence: true, length: { maximum: TITLE_MAX }
    validates :description, length: { maximum: DESCRIPTION_MAX }
    validate :parent_is_fixed, on: :update

    before_validation :set_root, on: :create
    after_create :join_owner!, if: :top?

    scope :top_level, -> { where(parent_id: nil) }
    scope :recent, -> { order(created_at: :desc) }

    def top?
      parent_id.nil?
    end

    def top
      top? ? self : root
    end

    def top_id
      root_id || id
    end

    def done?
      done_at.present?
    end

    def member?(account)
      return false if account.nil?

      Membership.member.exists?(project_id: top_id, account_id: account.id)
    end

    # Owned by someone, and that someone is still in the project.
    def owned_by?(account)
      account.present? && owner_id == account.id
    end

    # Its owner has gone (left, or their account was deleted).
    def up_for_grabs?
      owner_id.nil? || !member?(owner)
    end

    # Top-down, starting from the root: [Mini Doof, Live Stage].
    def ancestors
      chain = []
      node = parent
      while node
        chain.unshift(node)
        node = node.parent
      end
      chain
    end

    # Every part under this one, at any depth.
    def descendants
      parts = Project.where(root_id: top_id).to_a
      by_parent = parts.group_by(&:parent_id)
      found = []
      queue = [id]
      until queue.empty?
        kids = by_parent[queue.shift] || []
        found.concat(kids)
        queue.concat(kids.map(&:id))
      end
      found
    end

    # Parts or items under here that belong to someone else. A project can
    # only be removed by its owner, and only when nobody else has anything
    # in it: removing it must not take anyone else's work with it.
    def holds_others_work?(account)
      subtree_ids = [id] + descendants.map(&:id)
      others = ->(relation) { relation.where.not(owner_id: account.id).or(relation.where(owner_id: nil)) }

      others.call(Project.where(id: subtree_ids)).exists? ||
        others.call(Item.where(id: item_ids_within(subtree_ids))).exists?
    end

    # Remove this part and everything in it. Items that are also placed
    # somewhere outside it stay there.
    def remove!
      subtree_ids = [id] + descendants.map(&:id)
      gone = item_ids_within(subtree_ids)
      gone -= Placement.where(item_id: gone).where.not(project_id: subtree_ids).pluck(:item_id) unless top?

      transaction do
        Comment.where(subject_type: Item.name, subject_id: gone).delete_all
        Comment.where(subject_type: Project.name, subject_id: subtree_ids).delete_all
        Item.where(id: gone).delete_all
        destroy!
      end
    end

    private

    def set_root
      self.root_id = parent && (parent.root_id || parent.id)
    end

    def item_ids_within(project_ids)
      return Item.where(root_id: id).pluck(:id) if top?

      Placement.where(project_id: project_ids).distinct.pluck(:item_id)
    end

    def join_owner!
      memberships.create!(account_id: owner_id, state: :member) if owner_id
    end

    def parent_is_fixed
      errors.add(:parent_id, :invalid) if parent_id_changed?
    end
  end
end
