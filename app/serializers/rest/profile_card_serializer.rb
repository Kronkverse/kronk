# frozen_string_literal: true

class REST::ProfileCardSerializer < ActiveModel::Serializer
  include FormattingHelper

  attributes :id, :card_type, :body, :render, :visibility, :position, :visible, :settings

  def id
    object.id.to_s
  end

  def body
    # Same treatment as account.note — sanitised HTML with autolinking,
    # local account emoji, etc. Owner-authored identity content shares
    # the sanitisation vocabulary that bio does.
    return '' if object.body.blank?

    html_aware_format(object.body, object.account.local?)
  end
end
