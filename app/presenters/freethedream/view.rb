# frozen_string_literal: true

# The JSON shapes FreeTheDream's API answers with
# (Api::V1::Freethedream::*), built for one viewer: what they may do is
# worked out here so the page only has to show it.
#
# A project opens on its Overview (when, where, who's in it and what each
# is on, its working groups, what's happened lately); its Kontribute view
# has the sections, what's still needed and the lists
# (docs/spaces/freethedream.md).
module Freethedream
  class View
    include RoutingHelper

    STILL_NEEDED_MAX = 40
    UPDATES_MAX = 15

    def initialize(viewer)
      @viewer = viewer
    end

    def account(acct)
      return nil if acct.nil?

      {
        id: acct.id.to_s,
        acct: acct.acct,
        display_name: acct.display_name.presence || acct.username,
        avatar: full_asset_url(acct.avatar_static_url),
      }
    end

    # A project as a row in the list.
    def project_summary(project)
      tree = Tree.new(project.top)
      {
        id: project.id.to_s,
        title: project.title,
        description: project.description.truncate(240),
        owner: account(project.owner),
        cover: cover(project),
        ends_on: project.ends_on,
        done: project.done?,
        joining: project.joining,
        members_count: Membership.member.where(project_id: project.top_id).count,
        progress: tree.progress(project.id),
        membership: membership_state(project),
      }
    end

    def project(project)
      top = project.top
      tree = Tree.new(top)
      member = top.member?(@viewer)
      owner = project.owned_by?(@viewer)
      own_items = tree.items_in([project.id])

      {
        id: project.id.to_s,
        title: project.title,
        description: project.description,
        owner: account(project.owner),
        top: project.top?,
        root: { id: top.id.to_s, title: top.title },
        ancestors: project.ancestors.map { |a| { id: a.id.to_s, title: a.title } },
        cover: cover(project),
        event: event(project, owner),
        ends_on: project.ends_on,
        done: project.done?,
        joining: top.joining,
        up_for_grabs: project.up_for_grabs?,
        source_idea: project.source_idea && { id: project.source_idea_id.to_s, title: project.source_idea.title },
        progress: tree.progress(project.id),
        sections: tree.children(project.id).map { |section| section_row(section, tree) },
        still_needed: still_needed(project, tree),
        items: own_items.sort_by { |i| [i.created_at, i.id] }.map { |item| item_row(item) },
        depends_on: project.depends_on.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        needed_by: project.needed_by.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        updates: updates(tree.subtree_ids(project.id)),
        membership: membership_state(project),
        members_count: Membership.member.where(project_id: top.id).count,
        members: project.top? ? Membership.member.where(project_id: top.id).includes(:account).order(:created_at).map { |m| account(m.account) } : [],
        people: project.top? ? people(top, tree) : [],
        requests: project.top? && owner && member ? Membership.requested.where(project_id: top.id).includes(:account).order(:created_at).map { |m| account(m.account) } : [],
        all_parts: member ? tree.options : [],
        comments: comments(project),
        can: {
          add: member,
          edit: owner,
          remove: owner && !project.holds_others_work?(@viewer),
          take_over: member && !owner && project.up_for_grabs?,
          hand_over: owner && member,
          comment: member,
          invite: project.top? && member,
          link_event: project.top? && owner && member,
        },
      }
    end

    def cover(project)
      media = project.cover
      return nil if media.nil?

      { id: media.id.to_s, url: full_asset_url(media.file.url(:original)), preview_url: full_asset_url(media.file.url(:small)) }
    end

    # The project's Kalendar event as the Overview shows it, if the viewer
    # can see that event. `unlink` is for the project's owner.
    def event(project, owner)
      event, link = project.event_link
      return nil if event.nil? || !event.visible_to?(@viewer)

      rsvp = event.rsvps.find_by(account_id: @viewer.id)
      {
        id: event.id.to_s,
        slug: event.slug,
        title: event.title,
        start_time: event.start_time,
        end_time: event.end_time,
        location_name: event.location_name,
        location_url: event.location_url,
        image_url: event.image_url && full_asset_url(event.image_url),
        going_count: event.going_count,
        interested_count: event.interested_count,
        rsvp_enabled: event.rsvp_enabled,
        my_rsvp: rsvp&.status,
        attachment_id: link.id.to_s,
        can_unlink: owner || link.created_by_account_id == @viewer.id,
      }
    end

    def section_row(section, tree)
      {
        id: section.id.to_s,
        title: section.title,
        owner: account(section.owner),
        done: section.done?,
        sections_count: tree.children(section.id).size,
        people_count: tree.people_in(section.id).size,
        progress: tree.progress(section.id),
      }
    end

    # Who's in a project and what each is on, for its Overview: the
    # organiser first, then whoever leads a working group, then everyone
    # else in the order they joined.
    def people(top, tree)
      everything = tree.items_in(tree.subtree_ids(top.id))
      leads = tree.parts.group_by(&:owner_id)
      jobs = Hash.new(0)
      bringing = Hash.new(0)
      everything.each do |item|
        item.claims.each { |claim| jobs[claim.account_id] += 1 } if item.job_kind?
        item.offers.each { |offer| bringing[offer.owner_id] += 1 } if item.need_kind?
      end

      rows = Membership.member.where(project_id: top.id).includes(:account).order(:created_at).map do |membership|
        id = membership.account_id
        {
          account: account(membership.account),
          organiser: id == top.owner_id,
          leads: (leads[id] || []).map { |part| { id: part.id.to_s, title: part.title } },
          jobs: jobs[id],
          bringing: bringing[id],
        }
      end
      rows.each_with_index.sort_by { |row, i| [row[:organiser] ? 0 : 1, row[:leads].any? ? 0 : 1, i] }.map(&:first)
    end

    # Needs not yet met and jobs not yet filled, here and in every section
    # inside, each saying which section it's in.
    def still_needed(project, tree)
      ids = tree.subtree_ids(project.id)
      open = tree.items_in(ids).select { |i| (i.need_kind? || i.job_kind?) && !i.sorted? }
      open.sort_by { |i| [i.created_at, i.id] }.first(STILL_NEEDED_MAX).map do |item|
        where = tree.home_of(item, ids)
        item_row(item).merge(section: where && where.id != project.id ? { id: where.id.to_s, title: where.title } : nil)
      end
    end

    # An item as a row inside a project.
    def item_row(item)
      row = {
        id: item.id.to_s,
        kind: item.kind,
        title: item.title,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        owner: account(item.owner),
        mine: item.owned_by?(@viewer),
      }

      case item.kind
      when 'need'
        covered = item.covered
        row[:covered] = covered
        row[:left] = [item.quantity - covered, 0].max
        row[:spare] = [covered - item.quantity, 0].max
        row[:contributors] = item.offers.map { |o| { account: account(o.owner), quantity: o.quantity, offer_id: o.id.to_s } }
        row[:my_quantity] = @viewer ? item.offers.select { |o| o.owner_id == @viewer.id }.sum(&:quantity) : 0
      when 'job'
        row[:claimed] = item.claims.size
        row[:claimers] = item.claims.map { |c| account(c.account) }
        row[:claimed_by_me] = @viewer.present? && item.claims.any? { |c| c.account_id == @viewer.id }
      when 'offer'
        row[:need] = item.need && { id: item.need_id.to_s, title: item.need.title }
      when 'idea'
        taken = item.taken_on_as
        row[:taken_on] = taken && { type: taken.is_a?(Project) ? 'part' : 'job', id: taken.id.to_s, title: taken.title }
      end
      row
    end

    def item(item)
      member = item.member?(@viewer)
      owner = item.owned_by?(@viewer)
      root = item.root

      item_row(item).merge(
        body: item.body,
        root: { id: root.id.to_s, title: root.title },
        up_for_grabs: item.up_for_grabs?,
        placements: item.projects.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        offers: item.need_kind? ? item.offers.includes(:owner, :need).order(:created_at).map { |o| item_row(o) } : [],
        claims: item.job_kind? ? item.claims.includes(:account).order(:created_at).map { |c| account(c.account) } : [],
        source_idea: item.source_idea && { id: item.source_idea_id.to_s, title: item.source_idea.title },
        all_parts: member ? Tree.new(root).options : [],
        comments: comments(item),
        can: {
          edit: owner,
          remove: owner,
          take_over: member && !owner && item.up_for_grabs?,
          hand_over: owner && member,
          comment: member,
          offer: member && item.need_kind?,
          claim: member && item.job_kind?,
          take_on: member && item.idea_kind? && item.taken_on_as.nil?,
          place: member,
          unplace: owner && item.placements.size > 1,
        }
      )
    end

    # Threads, each with its replies nested under it. Resolved threads come
    # last.
    def comments(subject)
      all = subject.comments.includes(:account, :resolved_by).oldest_first.to_a
      by_parent = all.group_by(&:parent_id)
      build = lambda do |comment|
        {
          id: comment.id.to_s,
          account: account(comment.account),
          body: comment.body,
          removed: comment.removed?,
          created_at: comment.created_at,
          mine: @viewer.present? && comment.account_id == @viewer.id,
          resolved: comment.resolved?,
          resolved_by: comment.resolved? ? account(comment.resolved_by) : nil,
          replies: (by_parent[comment.id] || []).map { |reply| build.call(reply) },
        }
      end
      (by_parent[nil] || []).partition { |c| !c.resolved? }.flatten.map { |thread| build.call(thread) }
    end

    def updates(project_ids)
      Activity.where(project_id: project_ids).includes(:account, :project).latest.limit(UPDATES_MAX).map do |activity|
        {
          id: activity.id.to_s,
          verb: activity.verb,
          account: account(activity.account),
          project: { id: activity.project_id.to_s, title: activity.project.title },
          item_id: activity.item_id&.to_s,
          data: activity.data,
          created_at: activity.created_at,
        }
      end
    end

    def asset(asset)
      {
        id: asset.id.to_s,
        category: asset.category,
        title: asset.title,
        note: asset.note,
        quantity: asset.quantity,
        shared_with: asset.projects.map { |p| { id: p.id.to_s, title: p.title } },
      }
    end

    # The synergistic audit: per category, what the project needs set
    # against what its members have shared into it.
    def audit(top)
      needs = Item.need_kind.where(root_id: top.id).includes(:projects, :offers).to_a
      shared = Asset.joins(:shares).where(freethedream_shares: { project_id: top.id }).includes(:account).to_a
      categories = Item::CATEGORIES.keys.map(&:to_s)

      {
        root: { id: top.id.to_s, title: top.title },
        categories: (categories + [nil]).filter_map do |category|
          cat_needs = needs.select { |n| n.category == category }
          cat_shared = category ? shared.select { |a| a.category == category } : []
          next if category.nil? && cat_needs.empty?

          {
            category: category,
            needs: cat_needs.map do |need|
              { id: need.id.to_s, title: need.title, quantity: need.quantity, unit: need.unit, covered: need.covered, parts: need.projects.map(&:title) }
            end,
            shared: cat_shared.map do |a|
              { id: a.id.to_s, title: a.title, note: a.note, quantity: a.quantity, account: account(a.account) }
            end,
          }
        end,
      }
    end

    private

    def membership_state(project)
      return 'none' if @viewer.nil?

      Membership.find_by(project_id: project.top_id, account_id: @viewer.id)&.state || 'none'
    end

    # A whole project loaded once: its sections and its items with what
    # each needs to say whether it's sorted.
    class Tree
      def initialize(top)
        @top = top
        @parts = Project.where(root_id: top.id).includes(:owner).order(:created_at, :id).to_a
        @by_parent = @parts.group_by(&:parent_id)
        @by_id = ([top] + @parts).index_by(&:id)
        @items = Item.where(root_id: top.id).includes(:owner, :placements, :need, offers: :owner, claims: :account).to_a
      end

      attr_reader :parts

      def children(id)
        @by_parent[id] || []
      end

      # Everyone with a hand in a project or section: whoever owns it or
      # anything in it, has taken a job in it or is bringing something.
      def people_in(id)
        ids = subtree_ids(id)
        people = Set.new(ids.map { |part| @by_id[part]&.owner_id })
        items_in(ids).each do |item|
          people << item.owner_id
          item.claims.each { |claim| people << claim.account_id }
          item.offers.each { |offer| people << offer.owner_id }
        end
        people.delete(nil)
        people
      end

      def subtree_ids(id)
        ids = [id]
        queue = [id]
        until queue.empty?
          kids = children(queue.shift).map(&:id)
          ids.concat(kids)
          queue.concat(kids)
        end
        ids
      end

      def items_in(project_ids)
        wanted = project_ids.to_set
        @items.select { |item| item.placements.any? { |p| wanted.include?(p.project_id) } }
      end

      # The section an item sits in, inside the given ids.
      def home_of(item, project_ids)
        placement = item.placements.find { |p| project_ids.include?(p.project_id) }
        placement && @by_id[placement.project_id]
      end

      # Sorted against total, counting needs and jobs here and below.
      def progress(id)
        counted = items_in(subtree_ids(id)).select { |i| i.need_kind? || i.job_kind? }
        sorted = counted.count(&:sorted?)
        open_jobs = counted.select(&:job_kind?).sum(&:open_slots)
        { sorted: sorted, total: counted.size, open_jobs: open_jobs }
      end

      # Every project and section, for pickers, indented by depth.
      def options
        rows = []
        walk = lambda do |node, depth|
          rows << { id: node.id.to_s, title: node.title, depth: depth }
          children(node.id).each { |kid| walk.call(kid, depth + 1) }
        end
        walk.call(@top, 0)
        rows
      end
    end
  end
end
