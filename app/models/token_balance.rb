# frozen_string_literal: true

# A user's Kommons token balance.
#
# Stored rather than derived, with `TokenTransaction` as the audit trail —
# every change writes one, so a balance can be reconciled against the sum of
# its transactions at any time (see `#reconciles?`).
#
# Never mutate `balance` directly. All movement goes through `Kronk::Tokens`,
# which writes the transaction in the same lock and transaction.
class TokenBalance < ApplicationRecord
  STARTING_BALANCE = 10

  belongs_to :account

  validates :account_id, uniqueness: true
  validates :balance, numericality: { greater_than_or_equal_to: 0, only_integer: true }

  # Every local account should have a balance from the ledger migration, but
  # an account created before the balance hook (or by a fixture) may not.
  #
  # The `find_by || create!` pattern races on the first back!() call for a
  # brand-new account: two concurrent callers can both miss the row and both
  # attempt to create it, and the second insert raises RecordNotUnique against
  # the account_id unique index (see db/migrate/20260718090000_create_token_ledger.rb).
  # `find_or_create_by` retries the find on RecordNotUnique, closing the race.
  def self.for(account)
    find_or_create_by(account_id: account.id) { |b| b.balance = 0 }
  end

  def transactions
    TokenTransaction.where(account_id: account_id)
  end

  # The invariant the ledger exists to keep. Cheap enough to assert in specs
  # and to expose to a future reconciliation task.
  def reconciles?
    balance == transactions.sum(:amount)
  end
end
