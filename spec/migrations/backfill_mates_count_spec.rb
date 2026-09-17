# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20260915180000_backfill_mates_count.rb')

# The counter was added with a default of 0 and never backfilled, so every
# Mate bond formed before 2026-07-24 counted as nothing. This runs once and
# makes the stored number equal the graph.
RSpec.describe BackfillMatesCount do
  # A plain method rather than `subject`: one example runs it twice, to
  # prove re-running is a no-op, and a memoized subject would quietly
  # make that assertion meaningless.
  def run!
    migration = described_class.new
    migration.suppress_messages { migration.up }
  end

  let(:one)      { Fabricate(:account) }
  let(:other)    { Fabricate(:account) }
  let(:stranger) { Fabricate(:account) }

  # Make a mutual follow the way the pre-column data got there: rows
  # without the callbacks that maintain the counter.
  def silent_mutual(account, target)
    Follow.insert_all(
      [
        { account_id: account.id, target_account_id: target.id, created_at: Time.current, updated_at: Time.current },
        { account_id: target.id, target_account_id: account.id, created_at: Time.current, updated_at: Time.current },
      ]
    )
  end

  # Read the row, not the association: `Account#account_stat` builds an
  # unsaved record when there is none, which is exactly the state this
  # migration has to cope with.
  def stored_count(account)
    AccountStat.find_by(account_id: account.id)&.mates_count || 0
  end

  it 'counts a mutual pair that predates the counter' do
    silent_mutual(one, other)

    expect { run! }
      .to change { stored_count(one) }.from(0).to(1)
      .and change { stored_count(other) }.from(0).to(1)
  end

  it 'leaves a one-way follow uncounted' do
    Follow.insert_all([{ account_id: one.id, target_account_id: stranger.id, created_at: Time.current, updated_at: Time.current }])

    run!

    expect(stored_count(one)).to eq 0
    expect(stored_count(stranger)).to eq 0
  end

  it 'creates the stats row for an account that has none' do
    silent_mutual(one, other)
    AccountStat.where(account_id: [one.id, other.id]).delete_all

    run!

    expect(AccountStat.find_by(account_id: one.id).mates_count).to eq 1
  end

  it 'clears a count left behind by a pair that no longer exists' do
    one.account_stat.update!(mates_count: 7)

    run!

    expect(stored_count(one)).to eq 0
  end

  it 'leaves a correct count alone and is safe to run twice' do
    one.follow!(other)
    other.follow!(one)

    expect { run! }.to_not change { stored_count(one) }.from(1)
    expect { run! }.to_not change { stored_count(one) }.from(1)
  end

  it 'agrees with what the model computes' do
    silent_mutual(one, other)
    silent_mutual(one, stranger)

    run!

    expect(stored_count(one)).to eq one.mates.count
  end
end
