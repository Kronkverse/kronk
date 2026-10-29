# frozen_string_literal: true

# Kronk::MentionNudges — the "mentioned you" nudge for a local post
# (`status.mentioned`, via Kronk::StatusNudges). PostStatusService sends it
# for a new post and ProcessMentionsService for the people an edit newly
# names.
#
# Only a Mate of the author who can open the post is told (Tal 2026-10-29:
# "users should only be able to tag their mates"; "No reach without
# consent"). Naming anyone else nudges no one. A mention someone was not
# told about stays a link in the post: that part is Mastodon's engine
# (docs/spaces/feed.md, Mentions).
module Kronk
  module MentionNudges
    module_function

    def publish(status, mentions)
      author = status.account

      mentions.uniq(&:account_id).each do |mention|
        next if mention.silent?

        recipient = mention.account
        next unless recipient&.local? && author.mate?(recipient)
        next unless StatusPolicy.new(recipient, status).show?

        Kronk::StatusNudges.publish(
          'status.mentioned',
          actor_account_id: author.id,
          recipient_account_id: recipient.id,
          status_id: status.id,
          actor_acct: author.acct
        )
      end
    end
  end
end
