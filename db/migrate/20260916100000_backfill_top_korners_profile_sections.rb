# frozen_string_literal: true

# Kronk — cutover backfill: give every local account a starter profile
# by pre-populating up to three `ProfileSection` rows for the korners
# they've posted in the most.
#
# The 2.0 profile is section-driven — the shelved profile at `/@:acct`
# renders one shelf per `ProfileSection`, with content drawn from the
# owner's own statuses. Existing 1.x accounts arrive at cutover with
# no ProfileSection rows and land on the "This profile is quiet."
# empty state, hiding their real body of work behind a blank page.
#
# So: for each local account, tally posts per korner (using the same
# `manifest.status_association` / `status_post_type` dispatch the
# sections controller uses at read time), pick the top three, and
# write matching ProfileSection rows. Owners can rearrange / hide /
# delete in Arrange mode; the backfill is treated as their starting
# state, not their final one.
#
# **Idempotent.** Any account that already has at least one
# ProfileSection is left alone — the backfill only ever writes onto a
# blank canvas. Re-running the migration is a no-op.
#
# `safety_assured` because strong_migrations can't see how narrow this
# is — it's data-only, batched, skips populated accounts. Loop time on
# shadow's 112 local accounts is well under a minute; production scale
# is similar.
#
# See `docs/spaces/profile.md` § Cutover and
# `app/javascript/mastodon/features/profile_shelves/components/shelf_drawn.tsx`
# (the render-kind dispatch this maps into).
class BackfillTopKornersProfileSections < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  TOP_N = 3

  # Slug → client-side render kind. Values match the `switch
  # (canonicalRender(render))` branches in `ShelfDrawn`. Anything
  # unmapped falls back to `korner` (generic excerpt card), so a new
  # korner shipping after this migration still renders — the render
  # is client-driven and can land in a pure-frontend PR later.
  RENDER_BY_SLUG = {
    'albutts' => 'albutts_card',
    'art' => 'photo',
    'booth' => 'booth_card',
    'cinema' => 'longform',
    'kalendar' => 'event_card',
    'karporn' => 'photo',
    'kommons' => 'kommons_card',
    'kronikles' => 'longform',
    'kuestions' => 'kuestions_card',
    'map' => 'trek_card',
    'moments' => 'moment',
    'wachuneed' => 'wachuneed_card',
  }.freeze

  def up
    eligible = Kronk::KornerRegistry.all.select do |manifest|
      manifest.status_association.present? || manifest.status_post_type.present?
    end

    Account.local.find_each(batch_size: 100) do |account|
      next if account.profile_sections.exists?

      counts = compute_counts(account, eligible)
      # Sort by count desc, then slug asc (deterministic tie-break).
      top = counts.sort_by { |slug, count| [-count, slug] }.first(TOP_N)
      next if top.empty?

      safety_assured do
        top.each_with_index do |(slug, _count), index|
          account.profile_sections.create!(
            section_type: 'drawn',
            position: index,
            visible: true,
            settings: {
              'render' => RENDER_BY_SLUG.fetch(slug, 'korner'),
              'korner_slug' => slug,
              'order' => 'newest',
            },
            visibility: 'public'
          )
        end
      end
    end
  end

  def down
    # Reversing would mean deleting rows we cannot tell apart from
    # rows the owner has since Arranged / edited / added to. Leave
    # the backfill in place; the owner's own edits take precedence.
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def compute_counts(account, eligible_manifests)
    eligible_manifests.each_with_object({}) do |manifest, memo|
      scope = korner_scope(account, manifest)
      count = scope.count
      memo[manifest.slug] = count if count.positive?
    end
  end

  # Mirrors `Api::V1::Accounts::Profile::SectionsController#korner_statuses`
  # so the backfill counts what the read-side would show.
  def korner_scope(account, manifest)
    base = account.statuses
    if (assoc = manifest.status_association)
      base.joins(assoc).distinct
    elsif (post_type = manifest.status_post_type)
      base.where(post_type: Status.post_types[post_type.to_sym])
    else
      Status.none
    end
  rescue ActiveRecord::ConfigurationError
    Status.none
  end
end
