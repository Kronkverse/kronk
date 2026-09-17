# frozen_string_literal: true

# Per-user, per-korner settings blob. See spec §K.
#
# Reads/writes are cheap — one row per (user, korner) at most; absence
# means every setting resolves to its manifest default. The `values`
# hash is opaque to Rails; each korner's manifest declares what keys
# it accepts and the KornersController maps user input to writes here.
class UserKornerSetting < ApplicationRecord
  belongs_to :user

  validates :korner_slug, presence: true
  validates :user_id, uniqueness: { scope: :korner_slug }
end
