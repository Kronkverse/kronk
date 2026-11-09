# frozen_string_literal: true

# A comment never shows as a post of its own (docs/spaces/feed.md (Comments)).
# Froths and Bookmarks list what you frothed or bookmarked, so a comment there
# becomes the post it is on, and the serializer marks which comment it was
# (`kronk_comment_id`). The first entry for a post wins, so a post you frothed
# and a comment on it you frothed show once. A comment whose post is gone, or
# that you can no longer see, is left out. Pagination stays on the froths and
# bookmarks themselves, so a page may hold fewer than the limit.
module KronkCommentsAsPosts
  extend ActiveSupport::Concern

  private

  # @param statuses [Array<Status>]
  # @return [Array(Array<Status>, Hash{Integer => Integer})] the posts, and
  #   post id => comment id for the posts that stand in for a comment
  def comments_as_their_posts(statuses)
    marks = {}
    seen = Set.new

    posts = statuses.filter_map do |status|
      if status.reply?
        comment = status
        status = comment.thread_root
        next if status.nil? || status.reply? || !StatusPolicy.new(current_account, status).show?
      end
      next if seen.include?(status.id)

      seen << status.id
      marks[status.id] = comment.id if comment
      status
    end

    [posts, marks]
  end
end
