# frozen_string_literal: true

class REST::V1::KornerSerializer < ActiveModel::Serializer
  attributes :slug,
             :name,
             :icon,
             :render_target,
             :version,
             :resources,
             :storage,
             :security,
             :aesthetic,
             :notifications,
             :feed_projection,
             :settings,
             :emits,
             :listens,
             :hub_teaser,
             :launch,
             :portal,
             :feature_flag,
             :enforced
end
