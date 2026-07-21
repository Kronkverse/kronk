# frozen_string_literal: true

# REST::Nudges::EventSerializer — one inline event in a conversation
# stream. Ships the source-korner slug + verb + optional CTA; the
# client resolves the label + icon.
class REST::Nudges::EventSerializer < ActiveModel::Serializer
  attributes :id, :conversation_id, :source_korner_slug, :verb,
             :source_type, :source_id, :interaction,
             :cta_label, :cta_route, :created_at, :actor

  def id
    object.id.to_s
  end

  def conversation_id
    object.conversation_id.to_s
  end

  def source_id
    object.source_id&.to_s
  end

  def created_at
    object.created_at.iso8601
  end

  def actor
    REST::AccountSerializer.new(object.actor_account).as_json
  end
end
