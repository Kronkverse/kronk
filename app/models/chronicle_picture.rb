# frozen_string_literal: true

# == Schema Information
#
# Table name: chronicle_pictures
#
#  id                  :bigint(8)        not null, primary key
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  chronicle_id        :bigint(8)        not null
#  media_attachment_id :bigint(8)        not null
#

# A picture a Kronikle's body places between its paragraphs. Kept in step
# with the body by Chronicle#sync_pictures!.
class ChroniclePicture < ApplicationRecord
  belongs_to :chronicle
  belongs_to :media_attachment
end
