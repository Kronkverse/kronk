# frozen_string_literal: true

# Several specs replace a korner's attachment factory with a stub
# (Kronk::AttachmentFactories.reset! + register). Without this, the stub
# outlived the example, and whichever spec ran next and spawned an album from
# an event got the stub's stale record instead (order-dependent 422s).
RSpec.configure do |config|
  config.around do |example|
    saved = Kronk::AttachmentFactories.snapshot
    example.run
  ensure
    Kronk::AttachmentFactories.restore(saved)
  end
end
