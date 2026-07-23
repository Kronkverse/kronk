# frozen_string_literal: true

# KrewKorner — attachment registry per KRONK_KREWS §5. A row exists
# when a Krew has accreted a Korner (Booth, Kalendar, etc.); the
# attached Korner stores the reverse link so its own queries can
# scope to "Krews that own this <event | huddle | ...>". The set of
# accretable Korners is fixed at the model level.
class KrewKorner < ApplicationRecord
  KORNERS = %w(booth huddle kalendar kommons kompass albutts kuestions).freeze

  belongs_to :krew

  validates :korner, inclusion: { in: KORNERS }
  validates :krew_id, uniqueness: { scope: :korner }
end
