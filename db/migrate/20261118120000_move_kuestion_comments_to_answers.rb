# frozen_string_literal: true

# A Kuestion is answered, not commented on (Tal's proposal "Kuestions",
# 2026-11-18). People had been writing their answers as comments on the
# Kuestion's post, and from now its post shows no comments. So each comment
# becomes its writer's answer: same words, same time. The comment posts are
# left as they are.
#
# What becomes an answer:
# - Only comments made straight on the Kuestion's post, not replies to them.
# - Only on Kuestions answered in words (`text`). A choice or yes-or-no
#   Kuestion's answer is a pick, which a comment can't be read as.
# - One per person, since an answer is one per person and Kuestion: someone
#   who has already answered keeps their answer, and of several comments by
#   one person the first is taken.
# - Not the asker's own comments, which are talk about their question, not an
#   answer to it.
# - Not a comment with no words once the @mentions are taken off the front.
#
# Written straight to the table, after the model has checked it, so the
# asker isn't sent a nudge for each comment that moves. Running it again
# moves nothing twice.
class MoveKuestionCommentsToAnswers < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  LEADING_MENTIONS = /\A(?:\s*@[\w.-]+(?:@[\w.-]+)?)+\s*/

  SCOPES = {
    'public' => 'public',
    'unlisted' => 'public',
    'orbit' => 'orbit',
    'mates' => 'mates',
    'private' => 'mates',
  }.freeze

  def up
    Question.community.where(answer_format: 'text').where.not(status_id: nil).find_each do |question|
      comments = Status.where(in_reply_to_id: question.status_id, deleted_at: nil)
                       .where.not(account_id: question.created_by_account_id)
                       .reorder(:created_at, :id)

      comments.group_by(&:account_id).each_value do |own|
        move!(question, own.first)
      end
    end
  end

  def down
    # The comments were never touched; the answers may have been edited since.
  end

  private

  def move!(question, comment)
    return if Answer.exists?(question_id: question.id, account_id: comment.account_id)

    body = comment.text.to_s.sub(LEADING_MENTIONS, '').strip
    return if body.blank?

    answer = Answer.new(
      question_id: question.id,
      account_id: comment.account_id,
      body: body,
      visibility_scope: SCOPES.fetch(comment.visibility.to_s, 'self_only'),
      created_at: comment.created_at,
      updated_at: comment.created_at
    )
    return unless answer.valid?

    Answer.insert!(answer.attributes.except('id'))
  end
end
