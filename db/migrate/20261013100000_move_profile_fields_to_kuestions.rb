# frozen_string_literal: true

# Profile Kuestions replace profile Fields (docs/spaces/kuestions.md,
# "Profile Kuestions"). Each filled Field — a ProfileCard whose card_type is
# a seed key — becomes the member's answer to that seed, keeping its reach,
# whether it showed (pinned), its order and its size. The cards are left in
# place, unread, so nothing is lost if this has to be undone.
#
# A member who already answered that Kuestion keeps their answer. A card the
# answer can't hold (a birthday that isn't a date, a link with spaces in it)
# is skipped and stays on its card.
class MoveProfileFieldsToKuestions < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  ISO_DATE = /(\d{4}-\d{2}-\d{2})/

  def up
    Kuestions::ProfileSeeds.sync!
    questions = Question.profile.where.not(seed_key: nil).index_by(&:seed_key)

    ProfileCard.where(card_type: questions.keys).find_each do |card|
      question = questions[card.card_type]
      next if Answer.exists?(question_id: question.id, account_id: card.account_id)

      body = answer_body(card, question)
      next if body.blank?

      answer = Answer.new(
        question: question,
        account_id: card.account_id,
        body: body,
        visibility_scope: card.visibility,
        pinned_at: card.visible ? card.updated_at : nil,
        pin_position: card.visible ? card.position : nil,
        settings: card.tile_size ? { 'size' => card.tile_size } : {}
      )
      answer.save if answer.valid?
    end
  end

  def down
    # The cards were never touched; the answers may have been edited since.
  end

  private

  # Card bodies are stored as sanitised HTML ("<p>1999-11-01</p>"); line and
  # paragraph breaks become new lines so a paragraph or a list survives.
  def answer_body(card, question)
    html = card.body.to_s.gsub(%r{<br\s*/?>|</p>\s*<p>}i, "\n")
    text = CGI.unescapeHTML(ActionController::Base.helpers.strip_tags(html)).strip
    return ISO_DATE.match(text)&.[](1) if question.answer_format == 'date'

    text
  end
end
