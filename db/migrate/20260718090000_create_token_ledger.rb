# frozen_string_literal: true

# The Kommons token ledger.
#
# Tokens are a platform-level primitive introduced via Kommons: a user's
# balance is not Kommons-specific and may back other things later. So the
# balance and the audit log live at platform level (`token_*`), while the
# Kommons-specific act of backing a proposal lives under the korner's
# `proposal_` namespace, satisfying Standard L2.
#
# Balances are stored rather than derived. `token_transactions` is the
# audit trail — every balance change writes one, so a balance can always
# be reconciled against the sum of its transactions.
class CreateTokenLedger < ActiveRecord::Migration[8.0]
  STARTING_BALANCE = 10

  def up
    create_table :token_balances do |t|
      t.bigint  :account_id, null: false
      t.integer :balance,    null: false, default: 0
      t.timestamps null: false
    end

    add_index :token_balances, :account_id, unique: true
    add_foreign_key :token_balances, :accounts, on_delete: :cascade, validate: false

    create_table :token_transactions do |t|
      t.bigint  :account_id,  null: false
      t.integer :amount,      null: false # signed: negative spends, positive credits
      t.integer :kind,        null: false
      t.bigint  :proposal_id             # null for grants not tied to a proposal
      t.datetime :created_at, null: false
    end

    add_index :token_transactions, :account_id
    add_index :token_transactions, :proposal_id
    add_foreign_key :token_transactions, :accounts, on_delete: :cascade, validate: false
    add_foreign_key :token_transactions, :proposals, on_delete: :nullify, validate: false

    create_table :proposal_backings do |t|
      t.bigint :proposal_id, null: false
      t.bigint :account_id,  null: false
      t.integer :amount,     null: false
      t.timestamps null: false
    end

    # Not unique: backers may top up, so a backer has one row per investment.
    add_index :proposal_backings, [:proposal_id, :account_id]
    add_index :proposal_backings, :account_id
    add_foreign_key :proposal_backings, :proposals, on_delete: :cascade, validate: false
    add_foreign_key :proposal_backings, :accounts, on_delete: :cascade, validate: false

    grant_starting_balances!
  end

  def down
    drop_table :proposal_backings
    drop_table :token_transactions
    drop_table :token_balances
  end

  private

  # Every existing local account starts the rebuild with 10 tokens, and each
  # grant is recorded so the ledger reconciles from the first row.
  # Batched — this runs against every account on the instance.
  def grant_starting_balances!
    now = Time.now.utc

    Account.reset_column_information
    Account.where(domain: nil).where.not(username: 'mastodon.internal').in_batches(of: 1_000) do |batch|
      ids = batch.pluck(:id)
      next if ids.empty?

      balances = ids.map { |id| { account_id: id, balance: STARTING_BALANCE, created_at: now, updated_at: now } }
      transactions = ids.map { |id| { account_id: id, amount: STARTING_BALANCE, kind: 0, proposal_id: nil, created_at: now } }

      execute_insert(:token_balances, balances)
      execute_insert(:token_transactions, transactions)
    end
  end

  def execute_insert(table, rows)
    return if rows.empty?

    model = Class.new(ActiveRecord::Base) { self.table_name = table.to_s }
    model.insert_all(rows)
  end
end
