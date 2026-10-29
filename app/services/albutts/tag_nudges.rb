# frozen_string_literal: true

# Albutts::TagNudges — tells the people @named in a photo's caption that
# they were tagged in it (docs/spaces/albutts.md, Tagging people).
#
# One nudge per person per photo drop (Tal, 2026-10-29): twenty photos of
# you added in one go are "Sam tagged you in 20 photos", not twenty
# notifications. A drop is what Albutts::PublishPhotoBatch calls a burst:
# the photos one person adds to one album with no gap of QUIET between
# them. Its batch only exists once the burst has gone quiet, so the nudge
# can't wait for it; instead each tag collapses onto that person's last tag
# nudge for the album while it is still inside QUIET
# (Nudges::EventRouter, `aggregate_per_actor:`), and only the first pushes.
#
# One photo opens that photo; more open the album. A photo's post is kept
# out of fan-out, which is what normally announces a mention, so this is
# the only notice a tag in a caption gets.
module Albutts
  class TagNudges
    VERB = 'tagged_photo'

    def initialize(photo)
      @photo = photo
      @album = photo.album
      @contributor = photo.contributor
    end

    def call
      status = @photo.status
      return if status.nil?

      status.active_mentions.includes(:account).find_each do |mention|
        recipient = mention.account
        next if recipient.nil? || !recipient.local? || recipient.id == @contributor.id
        next unless @album.visible_to?(recipient)

        deliver(recipient)
      end
    end

    private

    def deliver(recipient)
      Nudges::EventRouter.deliver(
        actor: @contributor,
        recipient: recipient,
        source_korner_slug: 'albutts',
        verb: VERB,
        source_type: 'Album',
        source_id: @album.id,
        interaction: 'interactive',
        cta_label: 'View photo',
        cta_route: "/hub/albutts/albums/#{@album.id}?photo=#{@photo.id}",
        collapsed_cta_route: "/hub/albutts/albums/#{@album.id}",
        aggregate_window: Albutts::PublishPhotoBatch::QUIET,
        aggregate_per_actor: true,
        push_collapsed: false,
        directed: true
      )
    end
  end
end
