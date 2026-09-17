# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerRegistry, '.model_for' do
  before { described_class.reload! }

  it 'resolves kalendar to Event via the primary resource' do
    expect(described_class.model_for('kalendar')).to eq(Event)
  end

  it 'resolves albutts to Album' do
    expect(described_class.model_for('albutts')).to eq(Album)
  end

  it 'returns nil for a slug with no manifest' do
    expect(described_class.model_for('nowhere')).to be_nil
  end

  it 'returns nil for a manifest with no primary resource' do
    manifest = instance_double(Kronk::KornerRegistry::Manifest, resources: [])
    allow(described_class).to receive(:find).with('empty').and_return(manifest)
    expect(described_class.model_for('empty')).to be_nil
  end
end
