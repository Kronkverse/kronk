# frozen_string_literal: true

# Who may do what to a Wachuneed brand (docs/spaces/wachuneed.md, Brands).
# Seeing one is the controller's scope (`WachuneedBrand.shown_to`): every
# signed-in member, unless the proposer blocks them.
#
# update   — the proposer.
# destroy  — the proposer, or staff who handle reports (a brand that
#            shouldn't be there is taken down after the fact, the same
#            role that handles reports everywhere else).
# back     — any signed-in member but the proposer, who backs it already.
class WachuneedBrandPolicy < ApplicationPolicy
  def update?
    owned?
  end

  def destroy?
    owned? || staff?
  end

  def back?
    current_account.present? && !owned?
  end

  private

  def owned?
    current_account.present? && record.account_id == current_account.id
  end

  def staff?
    role.can?(:manage_reports)
  end
end
