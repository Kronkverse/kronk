# frozen_string_literal: true

class SpacePreviewController < ApplicationController
  skip_before_action :require_functional!
  content_security_policy false

  SPACES = {
    'kalendar' => {
      name: '₭alendar',
      wordmark: '₭ALENDAR',
      tagline: 'Events, gatherings & moments across the Kronk community.',
    },
    'kommons' => {
      name: '₭ommons',
      wordmark: '₭OMMONS',
      tagline: 'Propose ideas, vote on decisions and shape the direction of the Kronk community.',
    },
  }.freeze

  def show
    @space = SPACES[params[:space]]
    render status: :not_found and return if @space.nil?
    render layout: false
  end
end
