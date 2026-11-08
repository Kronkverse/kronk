# frozen_string_literal: true

# Tickets (docs/spaces/wachuneed.md, Tickets; Tal, 2026-11-09): a listing
# that sells seats has dates, each with how many seats and a linked
# Kalendar event; a ticket request names its date; a listing sold on
# another platform keeps a link to it instead.
class CreateListingTicketDates < ActiveRecord::Migration[8.1]
  def change
    create_table :listing_ticket_dates do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :starts_at, null: false
      t.datetime :ends_at
      t.string :place
      t.integer :seats
      t.bigint :event_id
      t.timestamps
    end
    add_index :listing_ticket_dates, :event_id

    add_column :listings, :ticket_url, :string
    add_column :listing_offers, :ticket_date_id, :bigint
    add_index :listing_offers, :ticket_date_id
  end
end
