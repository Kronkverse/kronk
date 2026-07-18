# frozen_string_literal: true

class Proposal < ApplicationRecord
  include Searchable

  searchable_as :kommons_proposals

  def as_json_for_search
    {
      id: id,
      title: title.to_s,
      body: body.to_s,
      summary: summary.to_s,
      created_by_account_id: created_by_account_id,
      status: status,
      categories: Array(categories),
      archived: archived?,
      created_at: created_at&.to_i,
    }
  end

  CATEGORY_VALUES = %w(timeline huddle events marketplace identity moderation infrastructure app design governance).freeze

  belongs_to :created_by_account, class_name: 'Account'
  belongs_to :parent_proposal, class_name: 'Proposal', optional: true
  # The discussion thread this proposal projects into the feed as.
  #
  # Named `:discussion` rather than `:status` — the §5.5 sibling convention
  # (Answer, BoothSet, Question, Event) — because Proposal is the one model
  # that also declares `enum :status` for its own lifecycle state. A
  # `belongs_to :status` shadows that enum's reader and writer, so
  # `Proposal.new(status: :open)` raised AssociationTypeMismatch and
  # `proposal.status` returned a Status object where every caller (the
  # serializer, and the whole governance UI) expects 'open'/'vetoed'/
  # 'delivered'/'in_progress'.
  #
  # The canonical §5.5 column name `status_id` is unchanged — only the Ruby
  # association is renamed, so the storage symmetry the spec cares about holds.
  belongs_to :discussion, class_name: 'Status', optional: true, foreign_key: :status_id, inverse_of: :proposal
  has_many :child_proposals, class_name: 'Proposal', foreign_key: :parent_proposal_id, dependent: :nullify, inverse_of: :parent_proposal

  # Transitional dual-write. `discussion_status_id` is the pre-2.0.0
  # column name; `status_id` is the canonical §5.5 name. Both attributes
  # remain populated during the transition so serializers, mailers, and
  # ActivityPub keep resolving. The old column is dropped in 2.1.0.
  def discussion_status_id=(value)
    super
    self[:status_id] = value if has_attribute?(:status_id)
  end

  def status_id=(value)
    super
    self[:discussion_status_id] = value if has_attribute?(:discussion_status_id)
  end

  # Deprecated reader — new code uses `#status`. Kept for compat with
  # ActivityPub serializers, existing view partials, and external callers
  # for one release. Logs once per process on first read so the sweep to
  # `#status` can be spotted from stray call-sites during 2.0.x.
  def discussion_status
    Proposal.warn_deprecated_status_read!
    discussion
  end

  def discussion_status_id
    Proposal.warn_deprecated_status_read!
    read_attribute(:discussion_status_id) || self[:status_id]
  end

  def self.warn_deprecated_status_read!
    return if @deprecated_status_read_warned

    @deprecated_status_read_warned = true
    Rails.logger.warn('[Proposal] deprecated read of discussion_status(_id); prefer #discussion / #status_id. Column drops in 2.1.0.')
  end
  has_many :proposal_votes, dependent: :destroy
  has_many :tasks, dependent: :destroy
  has_many :budget_items, dependent: :destroy

  enum :status, { open: 1, vetoed: 2, delivered: 3, in_progress: 4 }
  enum :proposal_type, { small: 0, medium: 1, large: 2 }, prefix: :type

  validates :title, presence: true, length: { maximum: 240 }
  validates :body,  presence: true
  validate  :categories_within_allowed_values
  validate  :node_id_registered

  scope :for_node, ->(node_id) { where(node_id: node_id) }

  scope :active,        -> { where(archived_at: nil) }
  scope :archived,      -> { where.not(archived_at: nil) }
  scope :recent,        -> { order(created_at: :desc) }
  scope :most_supported, lambda {
    left_joins(:proposal_votes)
      .select("proposals.*, COUNT(CASE WHEN proposal_votes.position = #{ProposalVote.positions[:agree]} THEN 1 END) AS agree_count")
      .group('proposals.id')
      .order(Arel.sql('agree_count DESC, proposals.created_at DESC'))
  }
  scope :most_discussed, lambda {
    left_joins(:proposal_votes)
      .select('proposals.*, COUNT(proposal_votes.id) AS total_votes')
      .group('proposals.id')
      .order(Arel.sql('total_votes DESC, proposals.created_at DESC'))
  }
  scope :with_category, ->(cat) { where('? = ANY(categories)', cat) }

  def archived?
    archived_at.present?
  end

  def participation_count
    proposal_votes.count
  end

  def support_count
    proposal_votes.where(position: :agree).count
  end

  def veto_count
    proposal_votes.where(position: :block).count
  end

  def vetoed_by_votes?
    proposal_votes.exists?(position: :block)
  end

  private

  def categories_within_allowed_values
    return if categories.blank?

    invalid = categories - CATEGORY_VALUES
    errors.add(:categories, "contains invalid values: #{invalid.join(', ')}") if invalid.any?
  end

  # node_id references Kronk::NodeRegistry (config, not a table). Nil is
  # allowed for classic structural proposals; a set value must resolve
  # to a registered node.
  def node_id_registered
    return if node_id.blank?
    return if Kronk::NodeRegistry.find(node_id)

    errors.add(:node_id, "'#{node_id}' is not a registered Kronk node")
  end
end
