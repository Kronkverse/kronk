# frozen_string_literal: true

# An identifier for the frontend build this process is serving, so an open
# tab can tell that a deploy shipped new code and reload itself (see
# `mastodon/utils/build_watcher.ts`). Long-lived tabs and the phone app keep
# running the code they loaded; old hashed chunks stay on disk after a
# deploy, so without this they can run a stale app indefinitely.
#
# The id is a digest of Vite's manifest, which changes whenever any bundle's
# content hash does, and is computed once per process: a deploy restarts
# Rails, so a new build means a new process. Falls back to the version
# string when no manifest exists (development before the first build).
module Kronk::Build
  module_function

  def id
    @id ||= compute
  end

  def reset!
    @id = nil
  end

  def compute
    manifest = ViteRuby.config.manifest_paths.find(&:exist?)
    return Digest::SHA256.file(manifest).hexdigest[0, 16] if manifest

    Digest::SHA256.hexdigest(Mastodon::Version.to_s)[0, 16]
  rescue StandardError
    'unknown'
  end
end
