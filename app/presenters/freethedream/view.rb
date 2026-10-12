# frozen_string_literal: true

# The JSON shapes FreeTheDream's API answers with
# (Api::V1::Freethedream::*), built for one viewer: what they may do is
# worked out here so the page only has to show it.
module Freethedream
  class View
    include RoutingHelper

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
      needs = project.top? ? Item.need_kind.where(root_id: project.id).to_a : []
      {
        id: project.id.to_s,
        title: project.title,
        description: project.description.truncate(240),
        owner: account(project.owner),
        ends_on: project.ends_on,
        done: project.done?,
        joining: project.joining,
        members_count: Membership.member.where(project_id: project.top_id).count,
        parts_count: Project.where(root_id: project.top_id).count,
        needs_count: needs.size,
        needs_met: needs.count { |need| need.covered >= need.quantity },
        membership: membership_state(project),
      }
    end

    def project(project)
      top = project.top
      member = top.member?(@viewer)
      owner = project.owned_by?(@viewer)
      items = project.items.includes(:owner, :claims, :need).order(:created_at, :id).to_a

      {
        id: project.id.to_s,
        title: project.title,
        description: project.description,
        owner: account(project.owner),
        top: project.top?,
        root: { id: top.id.to_s, title: top.title },
        ancestors: project.ancestors.map { |a| { id: a.id.to_s, title: a.title } },
        ends_on: project.ends_on,
        done: project.done?,
        joining: top.joining,
        up_for_grabs: project.up_for_grabs?,
        source_idea: project.source_idea && { id: project.source_idea_id.to_s, title: project.source_idea.title },
        parts: project.children.includes(:owner).order(:created_at, :id).map { |part| part_row(part) },
        items: items.map { |item| item_row(item) },
        depends_on: project.depends_on.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        needed_by: project.needed_by.order(:title).map { |p| { id: p.id.to_s, title: p.title } },
        membership: membership_state(project),
        members_count: Membership.member.where(project_id: top.id).count,
        members: project.top? ? Membership.member.where(project_id: top.id).includes(:account).order(:created_at).map { |m| account(m.account) } : [],
        requests: project.top? && owner && member ? Membership.requested.where(project_id: top.id).includes(:account).order(:created_at).map { |m| account(m.account) } : [],
        all_parts: member ? all_parts(top) : [],
        comments: comments(project),
        can: {
          add: member,
          edit: owner,
          remove: owner && !project.holds_others_work?(@viewer),
          take_over: member && !owner && project.up_for_grabs?,
          hand_over: owner && member,
          comment: member,
        },
      }
    end

    def part_row(part)
      {
        id: part.id.to_s,
        title: part.title,
        owner: account(part.owner),
        done: part.done?,
        parts_count: part.children.count,
        items_count: part.placements.count,
      }
    end

    # An item as a row inside a project.
    def item_row(item)
      row = {
        id: item.id.to_s,
        kind: item.kind,
        title: item.title,
        category: item.category,
        quantity: item.quantity,
        owner: account(item.owner),
        mine: item.owned_by?(@viewer),
      }

      case item.kind
      when 'need'
        covered = item.covered
        row[:covered] = covered
        row[:spare] = [covered - item.quantity, 0].max
      when 'job'
        claimed = item.claims.map(&:account_id)
        row[:claimed] = claimed.size
        row[:claimed_by_me] = @viewer.present? && claimed.include?(@viewer.id)
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
        all_parts: member ? all_parts(root) : [],
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

    def comments(subject)
      subject.comments.includes(:account).oldest_first.map do |comment|
        {
          id: comment.id.to_s,
          account: account(comment.account),
          body: comment.body,
          created_at: comment.created_at,
          mine: @viewer.present? && comment.account_id == @viewer.id,
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
      needs = Item.need_kind.where(root_id: top.id).includes(:projects).to_a
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
              covered = need.covered
              {
                id: need.id.to_s,
                title: need.title,
                quantity: need.quantity,
                covered: covered,
                parts: need.projects.map(&:title),
              }
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

    # Every project and part in a project, for pickers ("also show this
    # under…", "depends on…"), indented by depth.
    def all_parts(top)
      parts = Project.where(root_id: top.id).order(:created_at, :id).to_a.group_by(&:parent_id)
      rows = []
      walk = lambda do |node, depth|
        rows << { id: node.id.to_s, title: node.title, depth: depth }
        (parts[node.id] || []).each { |kid| walk.call(kid, depth + 1) }
      end
      walk.call(top, 0)
      rows
    end
  end
end
