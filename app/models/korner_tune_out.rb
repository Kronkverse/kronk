# frozen_string_literal: true

# Presence of a row means the account has tuned out of the named korner.
# Absence = tuned in (the default). See §N.5 in the korner spec.
class KornerTuneOut < ApplicationRecord
  belongs_to :account, inverse_of: :korner_tune_outs

  validates :korner_slug, presence: true
  validates :account_id, uniqueness: { scope: :korner_slug }
end
