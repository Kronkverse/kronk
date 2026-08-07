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
  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!
  before_action :set_subject

  def show
    members = build_members
    bonds   = build_bonds(members.pluck(:account_id))

    render json: {
      generated_at: Time.now.utc.iso8601,
      provenance: "Live from the Mates graph for #{@subject.acct}.",
      anchor_date: @subject.user&.created_at&.to_date&.iso8601 || @subject.created_at.to_date.iso8601,
      members: members.map { |m| m.except(:account_id) },
      mates: bonds,
    }
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
  def build_members
    subject_user   = @subject.user
    inviter        = subject_user&.invite&.user&.account
    invitees       = subject_user ? Account.joins(user: :invite).where(users: { invites: { user_id: subject_user.id } }) : Account.none
    mates          = @subject.mates

    accounts = Account.where(id: [@subject.id, inviter&.id, *invitees.pluck(:id), *mates.pluck(:id)].compact.uniq)
                      .includes(:user)
                      .to_a
                      .sort_by { |a| a.user&.created_at || a.created_at }

    accounts.each_with_index.map do |account, i|
      user = account.user
      {
        # `account_id` is a numeric join key kept only for `build_bonds`
        # below; stripped before serialisation.
        account_id: account.id,
        id: account.id.to_s,
        rank: i + 1,
        handle: account.acct,
        display_name: account.display_name.presence || account.username,
        joined_at: (user&.created_at || account.created_at).to_date.iso8601,
        inviter_id: user&.invite&.user_id ? Account.where(user_id: user.invite.user_id).pick(:id)&.to_s : nil,
        connections: account.mates.count,
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
      by_pair[key] = { count: (existing&.dig(:count) || 0) + 1, latest: [existing&.dig(:latest), at].compact.max }
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
