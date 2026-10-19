# frozen_string_literal: true

require 'rails_helper'

# `about:` is what the i moon's pop-up reads (SpaceInfoDialog). The registry
# keeps only the shape the pop-up can draw, so a typo in a manifest drops a
# line rather than breaking the pop-up.
RSpec.describe Kronk::KornerRegistry do
  def parse(yaml)
    Tempfile.create(['korner', '.yaml']) do |file|
      file.write(yaml)
      file.flush
      described_class.send(:parse_manifest, Pathname.new(file.path))
    end
  end

  it 'reads what, why and how' do
    manifest = parse(<<~YAML)
      slug: example
      name: Example
      about:
        what: 'A place for examples.'
        why: 'Because examples help.'
        how:
          - 'Open it.'
          - 'Look around.'
    YAML

    expect(manifest.about).to eq(
      'what' => 'A place for examples.',
      'why' => 'Because examples help.',
      'how' => ['Open it.', 'Look around.']
    )
  end

  it 'drops anything that is not the right shape' do
    manifest = parse(<<~YAML)
      slug: example
      name: Example
      about:
        what: 3
        why: '  '
        how: ['Open it.', 4, '']
        extra: 'ignored'
    YAML

    expect(manifest.about).to eq('how' => ['Open it.'])
  end

  it 'is nil when the manifest has none' do
    expect(parse("slug: example\nname: Example\n").about).to be_nil
  end

  it 'parses every shipped about block' do
    described_class.reload!
    stray = described_class.all.filter_map do |korner|
      extra = (korner.about || {}).keys - %w(what why how)
      "#{korner.slug}: #{extra.join(', ')}" if extra.any?
    end

    expect(stray).to be_empty
  end
end
