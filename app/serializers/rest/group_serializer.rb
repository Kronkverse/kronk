# frozen_string_literal: true

class REST::GroupSerializer < ActiveModel::Serializer
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
    object.group_memberships.count
  end

  def seeder_count
    object.group_memberships.where(role: 'seeder').count
  end

  # 'seeder' | 'member' | nil when the viewer isn't in the group.
  def viewer_role
    return nil if current_user.blank?

    object.group_memberships.find_by(account: current_user.account)&.role
  end

  private

  def current_user
    scope
  end
end
