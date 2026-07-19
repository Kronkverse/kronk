# frozen_string_literal: true

class EventsController < ApplicationController
  before_action :set_event

  def show
    expires_in 30.seconds, public: true
  end

  private

  def set_event
    @event = Event.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    not_found
  end
end
