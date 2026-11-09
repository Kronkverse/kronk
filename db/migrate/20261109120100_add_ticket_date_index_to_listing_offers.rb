# frozen_string_literal: true

# The ticket date a request is for (CreateListingTicketDates), indexed
# without blocking writes on listing_offers.
class AddTicketDateIndexToListingOffers < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def change
    add_index :listing_offers, :ticket_date_id, algorithm: :concurrently
  end
end
