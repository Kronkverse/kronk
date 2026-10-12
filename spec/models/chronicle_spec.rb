# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Chronicle do
  let(:owner)   { Fabricate(:account) }
  let(:mine)    { Fabricate(:media_attachment, account: owner, type: :image) }
  let(:another) { Fabricate(:media_attachment, account: owner, type: :image) }
  let(:theirs)  { Fabricate(:media_attachment, account: Fabricate(:account), type: :image) }

  def chronicle(body)
    described_class.create!(owner: owner, title: 'Low tide', kind: :essay, visibility: :public, body: body)
  end

  describe 'pictures in the body' do
    it 'keeps the ones the body names, when they are the owner\'s own' do
      piece = chronicle("First.\n\n![The point](picture:#{mine.id})\n\n![](picture:#{theirs.id})\n\n![](picture:999)\n\nLast.")

      expect(piece.pictures).to contain_exactly(mine)
    end

    it 'follows the body as it is edited' do
      piece = chronicle("![](picture:#{mine.id})")

      piece.update!(body: "No pictures now.\n\n![](picture:#{another.id})")

      expect(piece.reload.pictures).to contain_exactly(another)
    end

    it 'leaves a Kronikle\'s pictures out of the orphaned-media sweep' do
      chronicle("![](picture:#{mine.id})")
      another
      MediaAttachment.where(id: [mine.id, another.id]).update_all(created_at: 3.days.ago)

      Vacuum::MediaAttachmentsVacuum.new(nil).perform

      expect(MediaAttachment.where(id: [mine.id, another.id]).pluck(:id)).to eq [mine.id]
    end
  end

  describe '#excerpt' do
    it 'reads past a picture line' do
      piece = chronicle("# Low tide\n\n![The point at dawn](picture:#{mine.id})\n\nThe water was glass.")

      expect(piece.excerpt).to eq 'Low tide The water was glass.'
    end
  end
end
