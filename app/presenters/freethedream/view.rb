# frozen_string_literal: true

# The JSON shapes FreeTheDream's API answers with
# (Api::V1::Freethedream::*), built for one viewer: what they may do is
# worked out here so the page only has to show it.
#
# A project is one page: what's the viewer's (`mine`), its sections and
# their progress, what's still needed across everything inside, its own
# lists, its people, updates and talk (docs/spaces/freethedream.md).
module Freethedream
  class View
    include RoutingHelper

    STILL_NEEDED_MAX = 40
    UPDATES_MAX = 15
    MINE_NEEDED_MAX = 6

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
        inside: inside(project, tree),
        depends_on: project.depends_on.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        needed_by: project.needed_by.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        updates: updates(tree.subtree_ids(project.id)),
        membership: membership_state(project),
        members_count: Membership.member.where(project_id: top.id).count,
        members: project.top? ? Membership.member.where(project_id: top.id).includes(:account).order(:created_at).map { |m| account(m.account) } : [],
        people: project.top? ? people(top, tree) : [],
        level: level(project),
        crew: project.top? ? [] : crew(project, tree),
        gear: gear(project, tree),
        krew: top.krew && { id: top.krew.id.to_s, slug: top.krew.slug, name: top.krew.name },
        mine: project.top? && member ? mine(top, tree) : nil,
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

    # What's the viewer's in a project, for its dashboard: the working
    # groups they have a hand in, where there's talk they haven't seen, the
    # jobs they've taken, what they're bringing, and what's still needed in
    # their groups.
    def mine(top, tree)
      me = @viewer.id
      unseen = unseen_talk(top, tree)
      groups = tree.children(top.id).select { |group| tree.people_in(group.id).include?(me) }
      everything = tree.items_in(tree.subtree_ids(top.id))
      in_my_groups = groups.flat_map { |group| tree.subtree_ids(group.id) }
      needed = tree.items_in(in_my_groups).select { |i| (i.need_kind? || i.job_kind?) && !i.sorted? && i.claims.none? { |c| c.account_id == me } }
      inside = tree.subtree_ids(top.id) - [top.id]
      # Which gang or fractal it's in, so "On you" can say; nil when it's
      # on the emergence itself.
      where = lambda do |item|
        part = tree.home_of(item, inside)
        part && { id: part.id.to_s, title: part.title }
      end

      {
        groups: groups.map { |group| section_row(group, tree).merge(unseen: tree.subtree_ids(group.id).sum { |id| unseen[id] }) },
        unseen: tree.subtree_ids(top.id).filter_map { |id| unseen[id].positive? && { id: id.to_s, title: tree.part(id).title, count: unseen[id] } },
        jobs: everything.select { |i| i.job_kind? && i.claims.any? { |c| c.account_id == me } }.map { |i| { id: i.id.to_s, title: i.title, section: where.call(i) } },
        bringing: everything.select(&:need_kind?).flat_map do |need|
          need.offers.select { |o| o.owner_id == me }.map do |o|
            { id: need.id.to_s, title: need.title, quantity: o.quantity, unit: need.unit, about: need.quantity, more_welcome: need.more_welcome, section: where.call(need) }
          end
        end,
        needed: needed.sort_by { |i| [i.created_at, i.id] }.first(MINE_NEEDED_MAX).map do |item|
          where = tree.home_of(item, in_my_groups)
          item_row(item).merge(section: where && { id: where.id.to_s, title: where.title })
        end,
        needed_count: needed.size,
      }
    end

    # Per project or section, how many talk comments from other people are
    # newer than the viewer's last look at it (or than their joining).
    def unseen_talk(top, tree)
      ids = tree.subtree_ids(top.id)
      joined = Membership.member.find_by(project_id: top.id, account_id: @viewer.id)&.created_at || Time.current
      seen = Read.where(account_id: @viewer.id, project_id: ids).pluck(:project_id, :seen_at).to_h
      counts = Hash.new(0)
      Comment.where(subject_type: Project.name, subject_id: ids, created_at: joined..)
             .where.not(account_id: @viewer.id).where.not(body: '')
             .pluck(:subject_id, :created_at)
             .each { |id, at| counts[id] += 1 if at > (seen[id] || joined) }
      counts
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

    # Who's in an emergence and what each is on, for its Krew: whoever
    # did something in it most recently first. Doing something is an
    # update (adding, bringing, claiming), a comment, or joining; looking
    # at a page is not.
    def people(top, tree)
      everything = tree.items_in(tree.subtree_ids(top.id))
      active = last_active(top, tree, everything)
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
          last_active: [active[id], membership.created_at].compact.max,
        }
      end
      rows.each_with_index.sort_by { |row, i| [-row[:last_active].to_f, i] }.map(&:first)
    end

    # Who's in a gang or a fractal, and what each is on there: whoever
    # coalesced it or added, brings or is actualising anything in it. Most
    # on first (Tal, 2026-10-15: a gang's page leads with its people).
    def crew(project, tree)
      ids = tree.subtree_ids(project.id)
      on = Hash.new { |h, k| h[k] = { bringing: [], actualising: [] } }
      tree.items_in(ids).each do |item|
        item.offers.each { |offer| on[offer.owner_id][:bringing] << { id: item.id.to_s, title: item.title } } if item.need_kind?
        item.claims.each { |claim| on[claim.account_id][:actualising] << { id: item.id.to_s, title: item.title } } if item.job_kind?
      end
      people = tree.people_in(project.id)
      accounts = Account.where(id: people.to_a).index_by(&:id)

      rows = people.filter_map do |id|
        acct = accounts[id]
        next if acct.nil?

        { account: account(acct), bringing: on[id][:bringing].uniq, actualising: on[id][:actualising].uniq }
      end
      rows.each_with_index.sort_by { |row, i| [-(row[:bringing].size + row[:actualising].size), i] }.map(&:first)
    end

    # Gear gathered against gear listed, here and everything inside.
    def gear(project, tree)
      needs = tree.items_in(tree.subtree_ids(project.id)).select(&:need_kind?)
      { gathered: needs.count(&:sorted?), total: needs.size }
    end

    # Per person, when they last added, brought or claimed something, or
    # said something, anywhere in the project.
    def last_active(top, tree, everything)
      ids = tree.subtree_ids(top.id)
      said = Comment.where(subject_type: Project.name, subject_id: ids)
                    .or(Comment.where(subject_type: Item.name, subject_id: everything.map(&:id)))
      [Activity.where(root_id: top.id), said].map { |scope| scope.group(:account_id).maximum(:created_at) }
                                             .reduce { |a, b| a.merge(b) { |_, x, y| [x, y].max } }
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

    # What's in the gangs inside an emergence (needs, jobs, offers),
    # section by section, so each of its lists reads as everything under
    # it. What's placed on the project itself (for all of it) is in
    # `items`, not here.
    def inside(project, tree)
      inside = tree.subtree_ids(project.id) - [project.id]
      here = tree.items_in([project.id]).to_set
      found = tree.items_in(inside).reject { |i| here.include?(i) }.group_by { |i| tree.home_of(i, inside) }

      inside.filter_map do |id|
        items = found[tree.part(id)]
        next if items.blank?

        { section: { id: id.to_s, title: tree.part(id).title }, items: items.sort_by { |i| [i.created_at, i.id] }.map { |item| item_row(item) } }
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
        row[:more_welcome] = item.more_welcome
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
          place: member,
          unplace: owner && item.placements.size > 1,
        }
      )
    end

    # Threads, each with its replies nested under it. Resolved threads come
    # last.
    def comments(subject)
      all = subject.comments.includes(:account, :resolved_by, quoted_item: :offers).oldest_first.to_a
      by_parent = all.group_by(&:parent_id)
      # Who's tagged anywhere in it, looked up once: @username => account.
      names = all.flat_map(&:mentioned_usernames).uniq
      tagged = all.empty? ? {} : all.first.mentioned_accounts(names).index_by { |a| a.username.downcase }
      build = lambda do |comment|
        {
          id: comment.id.to_s,
          account: account(comment.account),
          body: comment.body,
          quoted_item: quoted(comment.quoted_item),
          mentions: comment.mentioned_usernames.filter_map { |name| tagged[name] && account(tagged[name]).merge(username: name) },
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

    # A thing on the list, as a card on a comment that quotes it.
    def quoted(item)
      return nil if item.nil?

      row = { id: item.id.to_s, kind: item.kind, title: item.title, quantity: item.quantity, unit: item.unit }
      item.need_kind? ? row.merge(covered: item.covered, more_welcome: item.more_welcome) : row
    end

    # A project's updates on their own, for its Activity to keep up with.
    def activity(project)
      updates(Tree.new(project.top).subtree_ids(project.id))
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

    def level(project)
      return 'emergence' if project.top?

      project.gang? ? 'gang' : 'fractal'
    end

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
        @items = Item.where(root_id: top.id).where.not(kind: :idea).includes(:owner, :placements, :need, offers: :owner, claims: :account).to_a
      end

      attr_reader :parts

      def part(id)
        @by_id[id]
      end

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
        open_jobs = counted.count { |i| i.job_kind? && !i.actualised? }
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
