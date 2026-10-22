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

  # `key` names a shelf: its korner, or korner:source for a shelf drawn
  # some other way than the account's own posts (`albutts:tagged`).
  def drawn_presets
    existing_keys = current_account
                    .profile_sections
                    .pluck(:settings)
                    .filter_map { |s| shelf_key(s) if s.is_a?(Hash) && s['korner_slug'] }
                    .to_set

    presets = Kronk::KornerRegistry.all.filter_map do |manifest|
      next if manifest.feed_projection&.dig('card').blank?

      count = count_statuses_for(manifest)
      {
        key: manifest.slug,
        korner_slug: manifest.slug,
        name: manifest.name,
        card: manifest.feed_projection['card'],
        source_label: source_label_for(manifest),
        count: count,
        already_added: existing_keys.include?(manifest.slug),
      }
    end
    albutts = presets.find { |preset| preset[:korner_slug] == 'albutts' }
    presets << tagged_preset(existing_keys, albutts[:card]) if albutts
    presets.unshift(gallery_preset(existing_keys))
  end

  # The photos and videos from your ordinary posts. Put on for you the first
  # time you post one (`ProfileSection.add_gallery!`); offered here so a
  # Gallery taken off can go back on.
  def gallery_preset(existing_keys)
    {
      key: 'profile:media',
      korner_slug: 'profile',
      source: 'media',
      name: 'Gallery',
      card: 'photo',
      source_label: 'Your photos and videos',
      count: ProfileSection.gallery_statuses(current_account).count,
      already_added: existing_keys.include?('profile:media'),
    }
  end

  # The album photos other people have tagged you in (Tal 2026-10-21),
  # shown with the Albutts card.
  def tagged_preset(existing_keys, card)
    {
      key: 'albutts:tagged',
      korner_slug: 'albutts',
      source: 'tagged',
      name: 'Tagged in photos',
      card: card,
      source_label: 'Albutts · photos you’re tagged in',
      count: tagged_count,
      already_added: existing_keys.include?('albutts:tagged'),
    }
  end

  def tagged_count
    Status.joins(:album_photo, :mentions)
          .where(mentions: { account_id: current_account.id, silent: false })
          .where.not(account_id: current_account.id)
          .distinct.count
  end

  def shelf_key(settings)
    source = settings['source'].presence
    source ? "#{settings['korner_slug']}:#{source}" : settings['korner_slug']
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
