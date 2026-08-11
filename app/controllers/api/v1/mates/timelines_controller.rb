# frozen_string_literal: true

# GET /api/v1/mates/timeline — the Mates-graph slice that powers the
# Mates timeline view at /@:acct/mates (features/mates_tab). Returns
# a snapshot of one subject's community: the subject itself, everyone
# it's mates with, the person who invited it (if any), and everyone
# it has invited into Kronk. Plus the mate bonds between all of them.
#
# The frontend (`use_mates_timeline.ts`) is designed around exactly
# this shape — no client-side massaging beyond the visual layout.
#
# Query params:
#   subject — optional handle (`@name` or bare `name`) of the account
#             to render. Defaults to `current_user.account`.
#
# What ships now vs. deferred:
#   ✓ real member set (self + mates + inviter + invitees, all local)
#   ✓ real bond dates (the later of the two follow.created_at)
#   ✓ real inviter chain from Invite → User → Account
#   ✗ korner tune-ins (returns [] for each member; needs the tune-in
#     graph, not currently exposed at the API layer)
#   ✗ vouch_count (0 for each; no vouches model yet)
#   ✗ locked / suspended subject gating (any signed-in user can look up
#     any other Kronker's timeline for now — the follow graph is public
#     anyway; harden with a policy check when the wider visibility
#     scope work lands per the 5 unresolveds in KRONK_KOMMUNITY.md)
class Api::V1::Mates::TimelinesController < Api::BaseController
  # `full_asset_url` (used in `build_members` to emit each account's
  # avatar URL, PR #1334) lives in RoutingHelper — Api::BaseController
  # doesn't include it, so every controller that reaches for asset
  # URLs pulls it in explicitly. Presence does the same.
  include RoutingHelper

  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!
  before_action :set_subject

  def show
    members = build_members
    bonds   = build_bonds(members.pluck(:account_id))

    render json: {
      generated_at: Time.now.utc.iso8601,
      provenance: "Live from the Mates graph for #{@subject.acct}.",
      anchor_date: (@subject.user&.created_at || @subject.created_at).to_date.iso8601,
      members: members.map { |m| m.except(:account_id) },
      mates: bonds,
    }
  rescue => e
    # Diagnostic rescue for the /@:acct/mates page — the outer shell
    # renders a generic "Couldn't load" state, so any 500 here is
    # invisible to the browser. Log the class + message + first frame
    # to Rails.logger, and surface the same to the JSON so we can pinpoint
    # a bad-data or missing-column issue on shadow without needing SSH
    # into the container. Follow-up removes the response echo once the
    # page is stable.
    Rails.logger.warn("Mates::Timeline#show error for subject=#{@subject&.acct.inspect}: #{e.class} #{e.message}\n  #{e.backtrace&.first}")
    render json: {
      error: 'timeline_failed',
      klass: e.class.name,
      message: e.message,
      where: e.backtrace&.first,
    }, status: 500
  end

  private

  def set_subject
    handle = params[:subject].to_s.delete_prefix('@').split('@', 2).first
    @subject = if handle.present?
                 Account.find_by(username: handle, domain: nil) ||
                   raise(ActiveRecord::RecordNotFound)
               else
                 current_account
               end
  end

  # The member set: subject + subject.mates + inviter + invitees. Sorted
  # by join date so `rank` is monotonic-in-time (rank 1 is oldest).
  #
  # Everything's resolved in bulk before the map so we don't N+1 on:
  #   - inviter-account lookup per member (map user_id → account_id up front)
  #   - mate-count per member (one grouped query for all members at once)
  def build_members
    subject_user = @subject.user
    inviter      = subject_user&.invite&.user&.account
    invitees     = if subject_user
                     Account.joins(user: :invite)
                            .where(invites: { user_id: subject_user.id })
                   else
                     Account.none
                   end

    account_ids = [@subject.id, inviter&.id, *invitees.pluck(:id), *@subject.mates.pluck(:id)].compact.uniq

    accounts = Account.where(id: account_ids)
                      .includes(user: :invite)
                      .to_a
                      .sort_by { |a| a.user&.created_at || a.created_at }

    # Bulk-resolve inviter's account_id for every member whose user has an
    # invite. Users don't have a direct `inviter_account_id`; the chain is
    # user → invite → invite.user → invite.user.account. Precompute one
    # `inviter_user_id → account_id` map so each member's inviter_id is a
    # cheap Hash lookup below (and users whose invites point at a purged
    # inviter fall through to nil).
    inviter_user_ids = accounts.filter_map { |a| a.user&.invite&.user_id }.uniq
    inviter_account_by_user = User.where(id: inviter_user_ids).pluck(:id, :account_id).to_h

    # One grouped `follows` count for every member's mate-count. Mate =
    # mutual follow, so the mate-count of an account is the count of its
    # outgoing follows whose target also follows back — that's a self-join
    # on the follows table. Cheap at N ≤ a few hundred; if we ever hit
    # thousands of members per timeline this should move to a
    # materialised view.
    mate_counts = Account.where(id: account_ids)
                         .joins('INNER JOIN follows f_out ON f_out.account_id = accounts.id')
                         .joins('INNER JOIN follows f_in ON f_in.target_account_id = accounts.id AND f_in.account_id = f_out.target_account_id')
                         .group('accounts.id')
                         .count

    accounts.each_with_index.map do |account, i|
      user = account.user
      inviter_user_id = user&.invite&.user_id
      {
        # `account_id` is a numeric join key kept only for `build_bonds`
        # below; stripped before serialisation.
        account_id: account.id,
        id: account.id.to_s,
        rank: i + 1,
        handle: account.acct,
        display_name: account.display_name.presence || account.username,
        # Static (non-animated) avatar variant — the list view renders
        # a plain <img>; animation is expensive at roster scale.
        avatar: full_asset_url(account.avatar_static_url),
        joined_at: (user&.created_at || account.created_at).to_date.iso8601,
        inviter_id: inviter_user_id ? inviter_account_by_user[inviter_user_id]&.to_s : nil,
        connections: mate_counts[account.id] || 0,
        korners: [],
        vouch_count: 0,
      }
    end
  end

  # Bonds between the member set: any mutual follow WITHIN it. The bond
  # date is the later of the two follow.created_at values (mutuality
  # doesn't exist until the second direction lands). Emitted with the
  # smaller id as member_a for deterministic ordering.
  def build_bonds(member_ids)
    return [] if member_ids.size < 2

    follows = Follow.where(account_id: member_ids, target_account_id: member_ids)
                    .pluck(:account_id, :target_account_id, :created_at)

    by_pair = {}
    follows.each do |src, tgt, at|
      a, b = [src, tgt].sort
      key = [a, b]
      existing = by_pair[key]
      by_pair[key] = {
        count: (existing&.dig(:count) || 0) + 1,
        latest: [existing&.dig(:latest), at].compact.max,
      }
    end

    by_pair.filter_map do |(a, b), entry|
      next unless entry[:count] == 2 # both directions present → mutual

      {
        member_a: a.to_s,
        member_b: b.to_s,
        mates_since: entry[:latest].to_date.iso8601,
      }
    end
  end
end
