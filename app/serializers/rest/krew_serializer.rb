# frozen_string_literal: true

class REST::KrewSerializer < ActiveModel::Serializer
  attributes :id, :slug, :name, :description, :discoverable,
             :governance_framework, :governance_threshold,
             :archived, :member_count, :seeder_count, :viewer_role

  def id
    object.id.to_s
  end

  def archived
    object.archived?
  end

  def member_count
    object.krew_memberships.count
  end

  def seeder_count
    object.krew_memberships.where(role: 'seeder').count
  end

  # 'seeder' | 'member' | nil when the viewer isn't in the krew.
  def viewer_role
    return nil if current_user.blank?

    object.krew_memberships.find_by(account: current_user.account)&.role
  end

  private

  def current_user
    scope
  end
end
