# frozen_string_literal: true

# Library — the catalogue of presets the composer's "add a shelf / add
# a card" grid draws from. Two lists in one payload:
#
#   * `told`  — every `ProfileCard::CARD_TYPES` value the account hasn't
#               filled in yet, plus one flag per already-filled type so
#               the client can decide whether to hide, gray out, or
#               offer "replace".
#
#   * `drawn` — every korner whose manifest declares a
#               `feed_projection.card`, with:
#                 - `count`         how many statuses this account has
#                                    that would qualify (feed_projection's
#                                    status_association or status_post_type)
#                 - `already_added` whether the account already has a
#                                    section whose settings.korner_slug
#                                    points at this korner
#
# Cross-korner presets (Photos, Longform, etc. from the mock) are
# deliberately not enumerated here — those are baked into the frontend
# per the round-2 hybrid answer. New korner? The Library grows
# automatically; new told preset requires the frontend team to add
# a card_type here (which the frontend already does anyway).
#
#   GET /api/v1/profile/library
class Api::V1::Profile::LibraryController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  def show
    render json: { told: told_presets, drawn: drawn_presets }
  end

  private

  def told_presets
    existing = current_account.profile_cards.pluck(:card_type).to_set

    ProfileCard::CARD_TYPES.map do |card_type|
      {
        card_type: card_type,
        already_added: existing.include?(card_type),
      }
    end
  end

  def drawn_presets
    existing_slugs = current_account
                     .profile_sections
                     .pluck(:settings)
                     .filter_map { |s| s.is_a?(Hash) ? s['korner_slug'] : nil }
                     .to_set

    Kronk::KornerRegistry.all.filter_map do |manifest|
      next if manifest.feed_projection&.dig('card').blank?

      count = count_statuses_for(manifest)
      {
        korner_slug: manifest.slug,
        name: manifest.name,
        card: manifest.feed_projection['card'],
        source_label: source_label_for(manifest),
        count: count,
        already_added: existing_slugs.include?(manifest.slug),
      }
    end
  end

  # How many of this account's statuses would populate a shelf bound
  # to this korner. Prefers the manifest's `status_association` (a
  # has_one on Status pointing at the korner's row); falls back to
  # `status_post_type` when the manifest declares a discriminator
  # instead of an association. Returns 0 on any query error rather
  # than blowing up the whole Library.
  def count_statuses_for(manifest)
    scope = current_account.statuses

    if (assoc = manifest.status_association)
      scope.joins(assoc).distinct.count
    elsif (post_type = manifest.status_post_type)
      scope.where(post_type: Status.post_types[post_type.to_sym]).count
    else
      0
    end
  rescue ActiveRecord::ConfigurationError, ArgumentError
    0
  end

  def source_label_for(manifest)
    tagline = manifest.tagline.to_s.strip
    return "#{manifest.name} · #{tagline}" if tagline.present?

    manifest.name
  end
end
