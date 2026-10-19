# frozen_string_literal: true

# The numbers a board of proposals shows on each tile (tasks, comments, the
# latest comment, attachments, backing), worked out for the whole page at
# once: one grouped query per kind instead of about fifteen per proposal.
# REST::ProposalSerializer uses it when the controller passes one in as
# `board_stats:`, and falls back to per-proposal queries otherwise.
class Kronk::ProposalBoardStats
  def initialize(proposals, account)
    @ids = proposals.map(&:id)
    @account_id = account&.id
  end

  def task_summary(id)
    counts = task_counts
    {
      open: counts[[id, 'open']] || 0,
      in_progress: counts[[id, 'in_progress']] || 0,
      done: counts[[id, 'done']] || 0,
    }
  end

  def comments_count(id)
    comment_counts[id] || 0
  end

  def latest_comment(id)
    latest_comments[id]
  end

  def attachments_count(id)
    attachment_counts[id] || 0
  end

  def backing_total(id)
    backing_totals[id] || 0
  end

  def backers(id)
    backer_counts[id] || 0
  end

  def my_stake(id)
    my_stakes[id] || 0
  end

  def my_balance
    return nil if @account_id.nil?

    @my_balance ||= TokenBalance.find_by(account_id: @account_id)&.balance || 0
  end

  private

  def task_counts
    @task_counts ||= Task.where(proposal_id: @ids).group(:proposal_id, :status).count
  end

  def comment_counts
    @comment_counts ||= ProposalComment.where(proposal_id: @ids).group(:proposal_id).count
  end

  def latest_comments
    @latest_comments ||= ProposalComment
                         .select('DISTINCT ON (proposal_comments.proposal_id) proposal_comments.*')
                         .where(proposal_id: @ids)
                         .reorder('proposal_comments.proposal_id, proposal_comments.created_at DESC')
                         .includes(:account)
                         .index_by(&:proposal_id)
  end

  def attachment_counts
    @attachment_counts ||= ProposalAttachment.where(proposal_id: @ids).group(:proposal_id).count
  end

  def backing_totals
    @backing_totals ||= ProposalBacking.where(proposal_id: @ids).group(:proposal_id).sum(:amount)
  end

  def backer_counts
    @backer_counts ||= ProposalBacking.where(proposal_id: @ids).group(:proposal_id).distinct.count(:account_id)
  end

  def my_stakes
    return {} if @account_id.nil?

    @my_stakes ||= ProposalBacking.where(proposal_id: @ids, account_id: @account_id).group(:proposal_id).sum(:amount)
  end
end
