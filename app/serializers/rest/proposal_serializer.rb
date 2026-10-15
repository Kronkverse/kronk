# frozen_string_literal: true

class REST::ProposalSerializer < ActiveModel::Serializer
  attributes :id, :title, :body, :summary, :status, :node_id,
             :proposal_type, :categories,
             :parent_proposal_id, :status_id, :discussion_status_id,
             :outcome_notes, :opens_at, :claimed_at,
             :support_count, :challenge_count, :participation_count,
             :created_at

  # The node's human name ("Nudges", not `nudges.index`) so the proposal page
  # can say which space it's about without leaking the registry id.
  attribute :node_label do
    object.node_id && Kronk::NodeRegistry.find(object.node_id)&.label
  end

  def parent_proposal_id
    object.parent_proposal_id&.to_s
  end

  def status_id
    object.status_id&.to_s
  end

  # Deprecated — mirrors status_id. Kept for one release so external
  # clients that read discussion_status_id continue to resolve.
  def discussion_status_id
    object.discussion_status_id&.to_s
  end

  # `current_vote` / `vote_summary` / `voters` / `challenges` were the
  # vote-model payload, retired 2026-08 in favour of token backing as
  # the sole support signal. No frontend reads them. Dropped from the
  # serializer to slim the per-row JSON on the board (Tal 2026-09-05).

  attribute :task_summary do
    next board.task_summary(object.id) if board

    {
      open: object.tasks.where(status: :open).count,
      in_progress: object.tasks.where(status: :in_progress).count,
      done: object.tasks.where(status: :done).count,
    }
  end

  # The board tile's signs of life: how much discussion there is, the latest
  # word of it (one line on the tile), and whether files are attached.
  attribute :comments_count do
    board ? board.comments_count(object.id) : object.proposal_comments.count
  end

  attribute :latest_comment do
    comment = board ? board.latest_comment(object.id) : object.proposal_comments.includes(:account).order(created_at: :desc).first
    comment && { username: comment.account.username, body: comment.body.truncate(140) }
  end

  attribute :attachments_count do
    board ? board.attachments_count(object.id) : object.proposal_attachments.count
  end

  # Token backing: the proposal's total staked, distinct backer count, the
  # viewer's own stake, the viewer's spendable balance, and whether backing is
  # still open. `my_balance` is nil for a signed-out viewer.
  attribute :backing do
    account_id = current_user&.account&.id
    if board
      total = board.backing_total(object.id)
      next {
        total: total,
        backers: board.backers(object.id),
        rank: backing_rank(total),
        my_stake: board.my_stake(object.id),
        my_balance: board.my_balance,
        open: Kronk::ProposalStates.backable?(object),
      }
    end

    total = object.backing_total
    {
      total: total,
      backers: ProposalBacking.backer_totals(object.id).size,
      rank: backing_rank(total),
      my_stake: account_id ? ProposalBacking.stake_of(object.id, account_id) : 0,
      my_balance: account_id ? (TokenBalance.find_by(account_id: account_id)&.balance || 0) : nil,
      open: Kronk::ProposalStates.backable?(object),
    }
  end

  # Kronk::ProposalBoardStats for the whole page, when the board passes one.
  def board
    instance_options[:board_stats]
  end

  belongs_to :created_by_account, serializer: REST::AccountSerializer
  # The dev on it. nil until claimed; kept after delivery as the record of
  # who built it.
  belongs_to :claimed_by_account, serializer: REST::AccountSerializer
  # Everyone who has joined the claimant on it, in the order they joined.
  has_many :joined_accounts, serializer: REST::AccountSerializer

  # This proposal's standing when active (open or claimed) proposals are ranked by total tokens
  # backed (1 = most-backed). nil for an unbacked proposal — "#N most-backed"
  # only means something once tokens are on it. Ties share a rank.
  #
  # The full totals list is computed once per request (RequestStore) and
  # reused across every serialization in the response, so an N-proposal
  # index page runs one aggregation query, not N. `bsearch_index` on the
  # desc-sorted totals gives the count of strictly-greater totals in
  # O(log N).
  def backing_rank(total)
    return nil unless total.positive?

    totals = self.class.open_totals_desc
    strictly_greater = totals.bsearch_index { |t| t <= total } || totals.size
    strictly_greater + 1
  end

  # Ordered totals (desc) of every backed active proposal, memoised per
  # request so the aggregation runs once even across N ProposalSerializer
  # instances. RequestStore clears between requests automatically.
  def self.open_totals_desc
    RequestStore.store[:kommons_open_totals_desc] ||=
      ProposalBacking
      .where(proposal_id: Proposal.active.select(:id))
      .group(:proposal_id)
      .sum(:amount)
      .values
      .sort
      .reverse
  end

  def id
    object.id.to_s
  end
end
