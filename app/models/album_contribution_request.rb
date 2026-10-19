# frozen_string_literal: true

# == Schema Information
#
# Table name: album_contribution_requests
#
#  id         :bigint(8)        not null, primary key
#  album_id   :bigint(8)        not null
#  account_id :bigint(8)        not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

# Someone asked to add photos to an album they can see but not add to
# (docs/spaces/albutts.md, Asking to add photos). Accepting puts them on
# the album's roster (`album_contributors`); either way the request goes.
class AlbumContributionRequest < ApplicationRecord
  belongs_to :album, inverse_of: :contribution_requests
  belongs_to :account
end
