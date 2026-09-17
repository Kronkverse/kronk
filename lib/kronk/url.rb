# frozen_string_literal: true

# Kronk::Url — canonical URL helpers for the /hub/<slug> grammar.
#
# Every korner mounts at /hub/<slug> under Kronk 2.0.0 (per §4 of
# docs/kronk_korner_spec.md). Rather than sprinkle string interpolation
# through mailers, notifications, and share generators, callers use:
#
#   Kronk::Url.hub_path('kommons')                   # => '/hub/kommons'
#   Kronk::Url.hub_path('kommons', 'proposals', 42)  # => '/hub/kommons/proposals/42'
#   Kronk::Url.hub_path('booth', 'sets', set.id)     # => '/hub/booth/sets/<id>'
#
# Slugs are validated against the registry: an unregistered slug raises
# ArgumentError so a typo is caught early. Segments after the slug are
# passed through untouched (URI-encoding is the caller's responsibility
# where user-supplied data is involved).

module Kronk
  module Url
    class UnknownSlug < ArgumentError; end

    module_function

    def hub_path(slug, *segments)
      slug_s = slug.to_s
      raise UnknownSlug, "no korner registered for slug '#{slug_s}'" unless known_slug?(slug_s)

      ['/hub', slug_s, *segments.map(&:to_s)].join('/')
    end

    def known_slug?(slug)
      Kronk::KornerRegistry.find(slug).present?
    end
  end
end
