# frozen_string_literal: true

# GET /api/v1/kommons/nodes
#
# Returns the full Kommons Tree — every user-facing page-type in Kronk,
# assembled from Kronk::NodeRegistry (config/kronk_nodes.yaml +
# per-korner manifest `nodes:` blocks) with per-node open-proposal
# counts joined in from the proposals table.
#
# Consumers: `app/javascript/mastodon/features/kommons_tree/*`.
# The frontend was mocking this in a hardcoded TypeScript array; this
# endpoint is the swap point.

class Api::V1::Kommons::NodesController < Api::BaseController
  before_action :require_user!

  def index
    @nodes = Kronk::NodeRegistry.all
    @counts = Proposal.open.where.not(node_id: nil).group(:node_id).count

    # `buckets` is the registry's ordered top-level list. The client keeps its
    # own compile-time `BUCKETS` union for exhaustiveness safety; shipping the
    # authoritative list here lets the client detect drift against the live
    # contract instead of silently drawing nodes of an unknown bucket nowhere.
    render json: {
      buckets: Kronk::NodeRegistry::BUCKETS,
      nodes: @nodes.map { |n| serialize_node(n) },
    }
  end

  private

  def serialize_node(node)
    {
      id: node.id,
      bucket: node.bucket,
      parent: node.parent,
      label: node.label,
      url: node.url,
      route_name: node.route_name,
      lifecycle: node.lifecycle,
      spa: node.spa?,
      open_proposals: @counts[node.id] || 0,
      links: Kronk::NodeRegistry.links_for(node.id),
    }
  end
end
