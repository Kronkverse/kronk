# frozen_string_literal: true

# One upload a lesson teaches with (docs/spaces/wachuneed.md, Lessons): a
# video, a recording or a picture, in the seller's order. Kept apart from
# the listing's photos, which anyone who can see the listing sees.
class ListingLessonMedium < ApplicationRecord
  self.table_name = 'listing_lesson_media'

  belongs_to :listing, inverse_of: :listing_lesson_media
  belongs_to :media_attachment
end
