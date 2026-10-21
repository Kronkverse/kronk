# frozen_string_literal: true

class REST::KrewSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :slug, :name, :description,
             :access, :listed, :discoverable,
             :governance_framework, :governance_threshold,
             :archived, :member_count, :seeder_count, :viewer_role,
             :viewer_requested, :join_request_count,
             :seeded_by_account_id, :last_activity_at,
             # Invite token only exposed to members (see #invite_token
             # below); the attribute is always declared for a stable
             # response shape.
             :invite_token,
             :korners, :requirements, :image_url

  def id
    object.id.to_s
  end

  def image_url
    object.image? ? full_asset_url(object.image.url(:original)) : nil
  end

  def seeded_by_account_id
    object.seeded_by_account_id&.to_s
  end

  def archived
    object.archived?
  end

  def listed
    object.listed?
  end

  # Counter cache is the source of truth (bumped by the Krew /
  # KrewMembership counter callbacks). Falls through to the live count
  # for rows created before the counter shipped.
  def member_count
    return object.member_count if object.member_count.positive?

    object.krew_memberships.count
  end

  def seeder_count
    object.krew_memberships.where(role: 'seeder').count
  end

  # 'seeder' | 'member' | nil when the viewer isn't in the krew.
  # Prefers the seeded_by pointer (Phase 3a single-seeder shape) so a
  # Krew created after this ships reports its planter as seeder even
  # if no legacy role='seeder' row exists.
  def viewer_role
    return nil if current_user.blank?

    account = current_user.account
    return 'seeder' if object.seeded_by_account_id == account.id

    object.krew_memberships.find_by(account: account)&.role
  end

  # The viewer has asked to join and is waiting on a member.
  def viewer_requested
    return false if current_user.blank?

    object.krew_join_requests.exists?(account_id: current_user.account_id)
  end

  # How many people are waiting to be let in. Members only: any of them can
  # answer a request. Everyone else gets 0.
  def join_request_count
    return 0 if current_user.blank? || !object.member?(current_user.account)

    object.krew_join_requests.count
  end

  # Invite tokens only surface to members, since any member can invite —
  # anyone else asking gets nil regardless of whether one exists. The URL
  # is meaningless without knowing the token, so hiding it here is the
  # whole gate.
  def invite_token
    return nil if current_user.blank?
    return nil unless object.member?(current_user.account)

    object.invite_token
  end

  # Accreted Korners: array of slug strings (booth / kalendar / …).
  # Order-independent; the frontend renders whatever's here.
  def korners
    object.krew_korners.pluck(:korner)
  end

  # Requirement rows for requirement_gated krews. Each entry carries
  # its kind + the kind-specific payload key. Not returned on
  # access != requirement_gated (empty array).
  def requirements
    return [] unless object.requirement_gated?

    object.krew_requirements.map do |r|
      {
        id: r.id.to_s,
        kind: r.kind,
        event_id: r.event_id&.to_s,
        region: r.region,
        vouch_params: r.vouch_params,
      }.compact
    end
  end

  private

  def current_user
    scope
  end
end
