# frozen_string_literal: true

# lib/kronk/*.rb aren't picked up by Rails' autoloader (config.autoload_lib
# is disabled — see config/application.rb). Requiring them explicitly at
# boot keeps every Kronk::* constant available without spraying
# require_relative through app/ code.
#
# Add new lib/kronk/*.rb files below when they ship.

require Rails.root.join('lib', 'kronk', 'version')
require Rails.root.join('lib', 'kronk', 'cycle_phase') # Klot phase calculator (added alpha.259 after missing loader = 500 on /api/v1/klot/self)
require Rails.root.join('lib', 'kronk', 'feature_flags')
require Rails.root.join('lib', 'kronk', 'kategories')
require Rails.root.join('lib', 'kronk', 'korner_events')
require Rails.root.join('lib', 'kronk', 'korner_content_streams')
require Rails.root.join('lib', 'kronk', 'korner_seen')
require Rails.root.join('lib', 'kronk', 'search')
require Rails.root.join('lib', 'kronk', 'tune_in_counts')
require Rails.root.join('lib', 'kronk', 'tune_in_gate')
require Rails.root.join('lib', 'kronk', 'url')
