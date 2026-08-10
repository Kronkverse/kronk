# frozen_string_literal: true

class StatusPolicy < ApplicationPolicy
  def initialize(current_account, record, preloaded_relations = {})
    super(current_account, record)

    @preloaded_relations = preloaded_relations
  end

  def show?
    return false if author.unavailable?

    # Reach tier first: if the status's reach tier already admits this
    # viewer, we're done — and crucially, a public/normal post never pays
    # for the krew membership query below (the hot feed path).
    return true if visible_by_reach?

    # Krew is an additive audience axis (KRONK_KREWS §3,
    # docs/rebuild/krew_axis_migration.md): even when the reach tier
    # excludes this viewer, a member of any Krew the status targets can
    # still see it. Checked only on the reach-miss path, so it costs a
    # query only for statuses the viewer couldn't otherwise see.
    viewer_in_targeted_krew?
  end

  def quote?
    show? && !blocking_author? && record.quote_policy_for_account(current_account, preloaded_relations: @preloaded_relations) != :denied
  end

  def reblog?
    !requires_mention? && !restricted_scope? && (!private? || owned?) && show? && !blocking_author?
  end

  def favourite?
    show? && !blocking_author?
  end

  def destroy?
    owned?
  end

  alias unreblog? destroy?

  def update?
    owned?
  end

  private

  # The reach-tier half of show? — the audience implied by the status's
  # `visibility` alone, ignoring any additive krew targeting.
  def visible_by_reach?
    if self_scoped?
      # Reach: self_only — the author's own timeline, no one else.
      owned?
    elsif mates_scoped?
      # Reach: mates — the author + their mutual connections.
      owned? || author_mate?
    elsif orbit_scoped?
      # Reach: orbit — mates + mates-of-mates (one hop out).
      owned? || author_mate? || in_author_orbit?
    elsif requires_mention?
      owned? || mention_exists?
    elsif private?
      owned? || following_author? || mention_exists?
    else
      current_account.nil? || (!author_blocking? && !author_blocking_domain?)
    end
  end

  def requires_mention?
    record.direct_visibility? || record.limited_visibility?
  end

  def owned?
    author.id == current_account&.id
  end

  def private?
    record.private_visibility?
  end

  def self_scoped?
    record.self_only_visibility?
  end

  def mates_scoped?
    record.mates_visibility?
  end

  def orbit_scoped?
    record.orbit_visibility?
  end

  # Local-only reach scopes that must never be reblogged into a wider
  # audience. (Krew-targeted posts are already covered: their reach tier
  # is one of these — a migrated krew post is self_only.)
  def restricted_scope?
    self_scoped? || mates_scoped? || orbit_scoped?
  end

  def author_mate?
    return false if current_account.nil?

    author.mate?(current_account)
  end

  def in_author_orbit?
    return false if current_account.nil?

    author.orbit_of?(current_account)
  end

  def viewer_in_targeted_krew?
    return false if current_account.nil?

    # The join is small (a Status targets N Krews, typically 1). A
    # single EXISTS is fine at API-scale.
    KrewMembership.exists?(
      account_id: current_account.id,
      krew_id: record.krews.select(:id)
    )
  end

  def mention_exists?
    return false if current_account.nil?

    if record.mentions.loaded?
      record.mentions.any? { |mention| mention.account_id == current_account.id }
    else
      record.mentions.exists?(account: current_account)
    end
  end

  def author_blocking_domain?
    return false if current_account.nil? || current_account.domain.nil?

    author.domain_blocking?(current_account.domain)
  end

  def blocking_author?
    return false if current_account.nil?

    @preloaded_relations[:blocking] ? @preloaded_relations[:blocking][author.id] : current_account.blocking?(author)
  end

  def author_blocking?
    return false if current_account.nil?

    @preloaded_relations[:blocked_by] ? @preloaded_relations[:blocked_by][author.id] : author.blocking?(current_account)
  end

  def following_author?
    return false if current_account.nil?

    @preloaded_relations[:following] ? @preloaded_relations[:following][author.id] : current_account.following?(author)
  end

  def author
    record.account
  end
end
