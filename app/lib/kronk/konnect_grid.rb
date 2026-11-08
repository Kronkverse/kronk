# frozen_string_literal: true

# The Konnect grid (decisions.md, 2026-11-08, "Konnect: what joins to
# what"): which korners Konnect to which, and how.
#
# Each manifest that takes links says what kind of korner it is and, per
# korner it Konnects to, whether it is a `space` there (turns a section
# on, with New and Add existing) or a `link` (ties one record):
#
#   konnect:
#     kind: work            # group, happening, work, exchange or talk
#     to:
#       krew: space
#       kalendar: link
#
# A pair is allowed when either side lists the other. Everything Konnects
# to a Krew, a projekt (freethedream), an event (kalendar) or a Place
# (map); works don't Konnect to works, nor groups to groups, except a Booth
# set to the Art on its cover. Konnections made before the grid stay; new
# ones outside it are refused (KornerAttachment#within_grid).
module Kronk
  module KonnectGrid
    module_function

    KINDS = %w(group happening work exchange talk).freeze
    MODES = %w(space link).freeze

    # What `row` is on `target`: 'space', 'link' or nil.
    def mode(row, target)
      to = Kronk::KornerRegistry.find(row.to_s)&.konnect
      to = to['to'] if to.is_a?(Hash)
      to.is_a?(Hash) ? to[target.to_s].presence : nil
    end

    def allowed?(slug_a, slug_b)
      mode(slug_a, slug_b).present? || mode(slug_b, slug_a).present?
    end
  end
end
