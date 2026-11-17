# frozen_string_literal: true

# Someone asking to use an ask-first sample (docs/spaces/booth.md, Samples).
# The maker says yes or no; a yes lets that person download it and list it
# under Samples used. One request per person and sample: asking again after
# a no reopens the same request.
class BoothSampleRequest < ApplicationRecord
  STATES = %w(pending yes no).freeze

  belongs_to :booth_sample, inverse_of: :requests
  belongs_to :account

  validates :state, inclusion: { in: STATES }
  validates :account_id, uniqueness: { scope: :booth_sample_id }

  scope :pending, -> { where(state: 'pending') }
end
