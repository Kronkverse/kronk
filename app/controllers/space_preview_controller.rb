# frozen_string_literal: true

class SpacePreviewController < ApplicationController
  skip_before_action :require_functional!
  content_security_policy false

  # rubocop:disable I18n/RailsI18n/DecorateString
  SPACES = {
    'home' => {
      name: 'Home',
      wordmark: 'HOME',
      tagline: 'Connect, share and follow along with the Kronk community.',
    },
    'huddle' => {
      name: 'Huddle',
      wordmark: 'HUDDLE',
      tagline: 'Live rooms, voice and video — gather with the Kronk community in real time.',
    },
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
  # rubocop:enable I18n/RailsI18n/DecorateString

  def show
    @space = SPACES[params[:space]]
    render status: 404 and return if @space.nil?

    render layout: false
  end
end
