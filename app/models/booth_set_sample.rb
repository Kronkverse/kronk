# frozen_string_literal: true

# A sample a set uses, credited under the set's Samples used and listed on
# the sample's page under Used in (docs/spaces/booth.md, Samples).
class BoothSetSample < ApplicationRecord
  belongs_to :booth_set, inverse_of: :set_samples
  belongs_to :booth_sample, inverse_of: :set_samples

  validates :booth_sample_id, uniqueness: { scope: :booth_set_id }
end
