# frozen_string_literal: true

# Who may do what with an app in Kollection (docs/spaces/kollection.md).
#
# show?    a live app: any signed-in member. A pulled one: its keeper and
#          admins.
# manage?  see its client key and secret, edit it, remove it: its keeper
#          and admins.
# admin?   pull and restore it, name a new keeper, see the admin page.
#
# "Admin" is `manage_settings`. An app that signs people in with Kronk is
# part of how the instance is set up, and naming a keeper hands that person
# its secret, so it sits with the people who look after the instance's
# settings rather than with moderators (`manage_reports`).
class KollectionAppPolicy < ApplicationPolicy
  def index?
    admin?
  end

  def show?
    record.live? || manage?
  end

  def manage?
    record.kept_by?(current_account) || admin?
  end

  def admin?
    role.can?(:manage_settings)
  end
end
