# frozen_string_literal: true

# A rose as the stack needs it: who it is from (revealed on tap) and
# when it arrived (arrival order is the stack order). No body, no
# read-state, no count — there is nothing else to a rose.
class REST::RoseSerializer < ActiveModel::Serializer
  attributes :id, :created_at

  belongs_to :from_account, serializer: REST::AccountSerializer
  # Only meaningful on the sent listing (`?direction=sent`), where the
  # question is who a rose went to rather than who sent it.
  belongs_to :to_account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
