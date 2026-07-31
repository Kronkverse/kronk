# frozen_string_literal: true

StrongMigrations.start_after = 2017_09_24_022025
StrongMigrations.target_version = 14

# Convention reminder: a migration that adds an index to a large *existing*
# table (statuses, accounts, …) must use `algorithm: :concurrently` under
# `disable_ddl_transaction!`. A non-concurrent index blocks writes, and the
# from-scratch CI "one step migration" flow enforces this (deploys bypass it
# via SAFETY_ASSURED, so it only surfaces in CI). Adding an index inside the
# `create_table` for a brand-new table is fine (no rows to block).
