# frozen_string_literal: true

# Kommunity — the Kronk orb data source.
#
#   GET /api/v1/kommunity/orb
#
# Returns the top-N local, active Kronk accounts (by degree) plus every
# follow edge between them. The Kommunity korner's <KronkOrb> visualises
# this: each account gets a point on a Fibonacci sphere, coloured and
# sized by connection count; edges become bezier chords between them.
#
# Response shape mirrors the bundled fallback
# (`orb_synthesised.json`), which the client uses on failure. See
# `app/javascript/mastodon/features/kosmos/use_mates_orb.ts`.
#
# Response is cached for CACHE_TTL — the orb is a whole-instance
# projection, so repeated hits from many viewers should share one
# computation. 5 minutes matches the pace at which follow / signup
# events would meaningfully change the shape of the sphere.
class Api::V1::Kommunity::OrbController < Api::BaseController
  include RoutingHelper

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  # How many accounts to put on the sphere. Matches the 150-socket
  # Fibonacci layout the client draws — sockets not filled show as
  # dim empty markers ("room to grow").
  SOCKET_COUNT = 150
  CACHE_KEY    = 'kommunity:orb:v1'
  CACHE_TTL    = 5.minutes

  def show
    data = Rails.cache.fetch(CACHE_KEY, expires_in: CACHE_TTL) { build_orb }
    render json: data
  rescue => e
    # A cache-backend / DB blip mustn't leave the surface with no
    # data — log and 500 with a friendly body; the client falls back
    # to the bundled JSON on non-2xx.
    Rails.logger.error("Kommunity#orb failed: #{e.class} #{e.message}")
    render json: { error: I18n.t('kronk.kommunity.orb_failed') }, status: 500
  end

  private

  # Pick the top-N local, non-stale accounts by degree (followers +
  # following) and shape them into the orb payload alongside every
  # follow edge that connects two orb members.
  def build_orb
    accounts = orb_accounts
    account_ids = accounts.map(&:id)

    follows = Follow.where(account_id: account_ids, target_account_id: account_ids)
                    .pluck(:account_id, :target_account_id)

    incoming = Hash.new(0)
    outgoing = Hash.new(0)
    interconnections = Hash.new(0)
    follows.each do |from_id, to_id|
      outgoing[from_id] += 1
      incoming[to_id] += 1
      interconnections[from_id] += 1
      interconnections[to_id] += 1
    end

    account_json = accounts.each_with_index.map do |account, i|
      stat = account.account_stat
      {
        id: account.id.to_s,
        username: account.username,
        display_name: account.display_name.presence || account.username,
        avatar_url: full_asset_url(account.avatar_static_url),
        rank: i,
        connections: stat.followers_count.to_i + stat.following_count.to_i,
        following: outgoing[account.id],
        followers: incoming[account.id],
        interconnections: interconnections[account.id],
      }
    end

    {
      generated_at: Time.current.iso8601,
      socket_count: SOCKET_COUNT,
      provenance: 'kommunity:v1',
      accounts: account_json,
      follows: follows.map { |from_id, to_id| [from_id.to_s, to_id.to_s] },
    }
  end

  # Matches the "stale" filters on `kommunity_discoverable_to`: local,
  # not suspended / silenced / memorialised / moved, backed by a
  # confirmed User row. Ordered by AccountStat degree so the sphere
  # foregrounds the community's most-connected accounts first (mirrors
  # the mock JSON's rank semantic).
  def orb_accounts
    Account.local
           .without_suspended
           .without_silenced
           .without_memorial
           .where(moved_to_account_id: nil)
           .where(id: User.where.not(confirmed_at: nil).select(:account_id))
           .joins(:account_stat)
           .order(Arel.sql('account_stats.followers_count + account_stats.following_count DESC'))
           .limit(SOCKET_COUNT)
           .includes(:account_stat)
           .to_a
  end
end
