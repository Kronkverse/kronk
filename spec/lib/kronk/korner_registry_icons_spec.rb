# frozen_string_literal: true

require 'rails_helper'

# Every korner names an icon in its manifest, and that name has to resolve
# to a real component in useKornerIcon. Two korners shipped in a row
# (2026-09-11) naming an icon nothing was wired to, and both fell through
# to the default glyph in the Hub and in their own chrome.
#
# `korners doctor` already catches this, but it is advisory on the
# integration branch, so the first sighting was a red job on somebody
# else's pull request. This is the same check in the suite, where it lands
# on the pull request that adds the korner.
RSpec.describe Kronk::KornerRegistry do
  # Parsed out of the TSX rather than imported — the map is the front end's
  # and this is the only place Ruby needs to read it. Mirrors the parse in
  # Mastodon::CLI::Korners#material_icon_names.
  let(:wired_icons) do
    source = Rails.root.join('app', 'javascript', 'mastodon', 'hooks', 'useKornerIcon.tsx').read
    body = source[/^const MATERIAL_TO_ICON\b[^=]*=\s*\{\n(.*?)^\};$/m, 1].to_s
    body.scan(/^\s*['"]?([a-z0-9_]+)['"]?\s*:/).flatten
  end

  # Core spaces have no Hub tile, so the map does not have to carry them.
  let(:korners) { described_class.all.reject(&:core?) }

  before { described_class.reload! }

  it 'parses the icon map' do
    expect(wired_icons).to include('hub'), 'could not read MATERIAL_TO_ICON — has useKornerIcon.tsx changed shape?'
  end

  it 'wires every icon a korner names' do
    missing = korners.filter_map do |korner|
      material = korner.icon.is_a?(Hash) ? korner.icon['material'] : nil
      next if material.blank? || wired_icons.include?(material)

      "#{korner.slug} names '#{material}'"
    end

    expect(missing).to be_empty,
                       "Icons named in a manifest but not in MATERIAL_TO_ICON: #{missing.join(', ')}. " \
                       'Add the SVG under app/javascript/material-icons/400-24px/ and a row in useKornerIcon.tsx.'
  end

  it 'gives every korner an icon to name' do
    unnamed = korners.reject { |korner| korner.icon.is_a?(Hash) && korner.icon['material'].present? }

    expect(unnamed.map(&:slug)).to be_empty
  end
end
