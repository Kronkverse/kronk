# frozen_string_literal: true

# Read-only listing of curated Kategories. Powers composer suggestions,
# profile section pickers, and the feed filter setting.
#
# Kategories reuse Mastodon's Tag model with `curated: true`. Uncurated
# tags remain regular hashtags — searchable but not surfaced in the
# framework's kategory pickers.
class Api::V1::KategoriesController < Api::BaseController
  skip_before_action :require_authenticated_user!

  def index
    cache_even_if_authenticated!
    render json: Tag.curated.order(:name).pluck(:name).map { |n| { name: n } }
  end
end
