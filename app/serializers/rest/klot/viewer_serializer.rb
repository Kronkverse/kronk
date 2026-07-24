# frozen_string_literal: true

# Outbound allowlist entry — a Kronker the caller has granted phase
# access to. `object` is an Account record.
class REST::Klot::ViewerSerializer < ActiveModel::Serializer
  attributes :account_id, :name, :handle

  def account_id
    object.id.to_s
  end

  def name
    object.display_name.presence || object.username
  end

  def handle
    object.acct
  end
end
