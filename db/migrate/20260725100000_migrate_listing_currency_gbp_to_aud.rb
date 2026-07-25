# frozen_string_literal: true

# Kronk is Australia-native — mARTketplace listings should quote in AUD.
# Any rows still stamped with the old default 'GBP' get flipped to 'AUD'
# in place. Amount cents stay as-is; this is a display-currency change,
# not a currency conversion (the seed mocks are the only rows this
# reaches in practice — shadow's small user base, no real-money moves
# depend on the stored value).
class MigrateListingCurrencyGbpToAud < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    return unless table_exists?(:listings)

    # strong_migrations can't inspect raw `execute`; this is an in-place
    # display-currency swap on a table with at most a few dozen rows
    # (shadow's small user base + a handful of seed mocks). No schema
    # change, no locking risk — wrap in safety_assured explicitly.
    safety_assured do
      execute <<~SQL.squish
        UPDATE listings
        SET    price_currency = 'AUD'
        WHERE  price_currency = 'GBP'
      SQL
    end
  end

  def down
    return unless table_exists?(:listings)

    safety_assured do
      execute <<~SQL.squish
        UPDATE listings
        SET    price_currency = 'GBP'
        WHERE  price_currency = 'AUD'
      SQL
    end
  end
end
