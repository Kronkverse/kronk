# frozen_string_literal: true

require 'singleton'
require 'yaml'

class Themes
  include Singleton

  THEME_COLORS = {
    dark: '#181820',
    light: '#ffffff',
  }.freeze

  def initialize
    @conf = YAML.load_file(Rails.root.join('config', 'themes.yml'))
  end

  # Light is off for now (Tal, 2026-11-26, Kommons "Light theme"). The two
  # themes that can render light stay valid, so stored choices are kept, but
  # they render as the dark default (ApplicationController#current_theme) and
  # aren't offered.
  LIGHT = %w(system mastodon-light).freeze

  def names
    ['system'] + @conf.keys
  end

  def offered
    names - LIGHT
  end
end
