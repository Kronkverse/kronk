# frozen_string_literal: true

class EventInvitation < ApplicationRecord
  belongs_to :event
  belongs_to :account
  belongs_to :invited_by, class_name: 'Account'

  enum :status, { pending: 0, accepted: 1, declined: 2 }, prefix: true

  validates :account_id, uniqueness: { scope: :event_id }
end
