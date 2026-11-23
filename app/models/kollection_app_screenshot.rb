# frozen_string_literal: true

# One screenshot on a Kollection app's page, in order
# (docs/spaces/kollection.md). An ordinary upload; the media vacuum keeps it
# while it is listed here.
class KollectionAppScreenshot < ApplicationRecord
  belongs_to :kollection_app, inverse_of: :screenshots
  belongs_to :media_attachment
end
