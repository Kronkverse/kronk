# frozen_string_literal: true

# KrewKorner — attachment registry (docs/spaces/krew.md). A row exists
# when a Krew has accreted a Korner (Booth, Kalendar, etc.); the
# attached Korner stores the reverse link so its own queries can
# scope to "Krews that own this <event | huddle | ...>". The set of
# accretable Korners is fixed at the model level.
#
# `nudges` is the Krew's chat (Tal, 2026-10-31; decisions.md): a Krew has
# one only once it is Konnected. Without the row its conversation, if any,
# stays where it is but is neither listed in Nudges nor shown on the page.
class KrewKorner < ApplicationRecord
  KORNERS = %w(booth huddle kalendar kommons map albutts kuestions nudges).freeze

  belongs_to :krew

  validates :korner, inclusion: { in: KORNERS }
  validates :krew_id, uniqueness: { scope: :korner }
end
