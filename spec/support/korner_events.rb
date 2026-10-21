# frozen_string_literal: true

# Several specs call Kronk::KornerEvents.reset! to listen for one event.
# That cleared the boot-time subscribers (the Nudges listens) for every spec
# run after it in the same process, so a spec relying on them, such as a
# rose becoming a notification, passed or failed by order. Each example now
# gets the bus back as it found it.
RSpec.configure do |config|
  config.around do |example|
    subscribers = Kronk::KornerEvents.snapshot
    example.run
  ensure
    Kronk::KornerEvents.restore(subscribers)
  end
end
