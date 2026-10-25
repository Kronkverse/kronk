# frozen_string_literal: true

module BrowserErrorsHelpers
  def ignore_js_error(error)
    @ignored_js_errors_for_spec << error
  end
end

RSpec.configure do |config|
  config.include BrowserErrorsHelpers, :js, type: :system

  config.before(:each, :js, type: :system) do |example|
    @ignored_js_errors_for_spec = []

    example.metadata[:js_console_messages] ||= []
    Capybara.current_session.driver.with_playwright_page do |page|
      page.on('console', lambda { |msg|
        example.metadata[:js_console_messages] << { type: msg.type, text: msg.text, location: msg.location }
      })
    end
  end

  config.after(:each, :js, type: :system) do |example|
    # Classes of intermittent ignorable errors
    ignored_errors = [
      /Error while trying to use the following icon from the Manifest/, # https://github.com/mastodon/mastodon/pull/30793
      /Manifest: Line: 1, column: 1, Syntax error/, # Similar parsing/interruption issue as above
    ].concat(@ignored_js_errors_for_spec)

    # Home's Huddle banner asks the real Jitsi server who's in, and it answers
    # 404 when the room is empty. The browser logs that as an error, so specs
    # would pass or fail on whether anyone is in the Huddle. The console text
    # doesn't say what failed to load, so this goes by the location.
    room_size = %r{\Ahttps://#{Regexp.escape(Rails.configuration.x.kronk_jitsi_domain)}/room-size\?}

    errors = example.metadata[:js_console_messages].reject do |msg|
      url = msg[:location].to_h.then { |location| location['url'] || location[:url] }.to_s
      ignored_errors.any? { |pattern| pattern.match(msg[:text]) } || room_size.match?(url)
    end

    if errors.present?
      aggregate_failures 'browser errrors' do
        errors.each do |error|
          # The console text of a failed load doesn't say what failed; the location does.
          expect(error[:type]).to_not eq('error'), [error[:text], error.dig(:location, 'url') || error.dig(:location, :url)].compact.join(' @ ')
          next unless error[:type] == 'warning'

          warn 'WARN: browser warning'
          warn error[:text]
        end
      end
    end
  end
end
