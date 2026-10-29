# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ChronicleSeries do
  let(:writer) { Fabricate(:account) }
  let(:reader) { Fabricate(:account) }
  let(:series) { described_class.create!(owner: writer, title: 'The long walk') }

  def chapter(title, visibility: :public, owner: writer, into: series)
    Chronicle.create!(owner: owner, title: title, body: "#{title}.", kind: :short_story, visibility: visibility, series: into)
  end

  def mates!(one, other)
    one.follow!(other)
    other.follow!(one)
  end

  describe 'chapters' do
    it 'go in the order they are added' do
      first = chapter('Setting out')
      second = chapter('The river')

      expect(series.chapters).to eq [first, second]
      expect([first.series_position, second.series_position]).to eq [1, 2]
    end

    it 'take a new order that names each of them once' do
      first = chapter('Setting out')
      second = chapter('The river')

      expect(series.reorder_chapters!([second.id, first.id])).to be true
      expect(series.chapters.reload).to eq [second, first]
    end

    it 'refuse an order that leaves one out or adds another' do
      first = chapter('Setting out')
      second = chapter('The river')
      elsewhere = chapter('Not in it', into: nil)

      expect(series.reorder_chapters!([second.id])).to be false
      expect(series.reorder_chapters!([second.id, first.id, elsewhere.id])).to be false
      expect(series.reorder_chapters!([first.id, first.id])).to be false
      expect(series.chapters.reload).to eq [first, second]
    end

    it 'are only the owner’s own Kronikles' do
      theirs = Chronicle.new(owner: reader, title: 'Mine', body: 'Mine.', visibility: :public, series: series)

      expect(theirs).to_not be_valid
      expect(theirs.errors[:series]).to be_present
    end

    it 'go last when moved in, and lose their place when taken out' do
      first = chapter('Setting out')
      loose = chapter('Later', into: nil)

      loose.update!(series: series)
      expect(loose.series_position).to eq 2

      first.update!(series: nil)
      expect(first.reload.series_position).to be_nil
      expect(series.chapters.reload).to eq [loose]
    end
  end

  describe 'deleting a Series' do
    it 'keeps its Kronikles, out of any Series' do
      first = chapter('Setting out')

      series.destroy!

      expect(first.reload).to have_attributes(series_id: nil, series_position: nil)
    end
  end

  describe 'who sees it' do
    it 'is seen as far as its chapters are' do
      chapter('For my Mates', visibility: :mates)

      expect(series.visible_to?(reader)).to be false
      expect(described_class.visible_to(reader)).to_not include(series)

      mates!(writer, reader)

      expect(series.visible_to?(reader)).to be true
      expect(described_class.visible_to(reader)).to include(series)
    end

    it 'is always seen by its owner, even empty' do
      expect(series.visible_to?(writer)).to be true
      expect(described_class.visible_to(writer)).to include(series)
      expect(series.visible_to?(reader)).to be false
      expect(series.visible_to?(nil)).to be false
    end

    it 'numbers a chapter among the ones the reader can see' do
      first = chapter('Setting out')
      chapter('Just for me', visibility: :self_only)
      third = chapter('The river')

      expect(third.chapter_for(reader)).to eq(number: 2, count: 2, previous_id: first.id.to_s, next_id: nil)
      expect(third.chapter_for(writer)).to include(number: 3, count: 3)
      expect(first.chapter_for(reader)).to eq(number: 1, count: 2, previous_id: nil, next_id: third.id.to_s)
    end
  end
end
