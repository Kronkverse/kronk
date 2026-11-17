# frozen_string_literal: true

Fabricator(:booth_sample) do
  account          { Fabricate.build(:account) }
  title            'Test loop'
  sample_type      'loop'
  terms            'free'
  duration_seconds 8
  audio_attachment { |attrs| Fabricate(:media_attachment, account: attrs[:account], type: :audio, file: attachment_fixture('boop.mp3')) }
end
