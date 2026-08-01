# frozen_string_literal: true

class REST::StatusSerializer < ActiveModel::Serializer
  include FormattingHelper

  # Please update `app/javascript/mastodon/api_types/statuses.ts` when making changes to the attributes

  attributes :id, :created_at, :in_reply_to_id, :in_reply_to_account_id,
             :sensitive, :spoiler_text, :visibility, :language,
             :uri, :url, :replies_count, :reblogs_count,
             :favourites_count, :quotes_count, :edited_at,
             :post_type, :krews, :source_korner

  attribute :favourited, if: :current_user?
  attribute :reblogged, if: :current_user?
  attribute :muted, if: :current_user?
  attribute :bookmarked, if: :current_user?
  attribute :pinned, if: :pinnable?
  has_many :filtered, serializer: REST::FilterResultSerializer, if: :current_user?

  attribute :content, unless: :source_requested?
  attribute :text, if: :source_requested?

  belongs_to :reblog, serializer: REST::StatusSerializer
  belongs_to :application, if: :show_application?
  belongs_to :account, serializer: REST::AccountSerializer

  has_many :ordered_media_attachments, key: :media_attachments, serializer: REST::MediaAttachmentSerializer
  has_many :ordered_mentions, key: :mentions
  has_many :tags
  has_many :emojis, serializer: REST::CustomEmojiSerializer

  # Due to a ActiveModel::Serializer quirk, if you change any of the following, have a look at
  # updating `app/serializers/rest/shallow_status_serializer.rb` as well
  has_one :quote, key: :quote, serializer: REST::QuoteSerializer
  has_one :preview_card, key: :card, serializer: REST::PreviewCardSerializer
  has_one :preloadable_poll, key: :poll, serializer: REST::PollSerializer
  has_one :event, serializer: REST::EventSerializer
  has_one :proposal, serializer: REST::ProposalSummarySerializer
  has_one :booth_set, serializer: REST::BoothSetSummarySerializer
  has_one :listing, serializer: REST::WachuneedListingSummarySerializer
  has_one :trek, serializer: REST::TrekSummarySerializer, if: :trek_visible_to_viewer?
  has_one :question, serializer: REST::QuestionSummarySerializer
  has_one :album, serializer: REST::AlbumSummarySerializer, if: :album_visible_to_viewer?
  has_one :quote_approval

  def quote
    object.quote if object.quote&.acceptable?
  end

  def post_type
    object.post_type
  end

  def id
    object.id.to_s
  end

  def in_reply_to_id
    object.in_reply_to_id&.to_s
  end

  def in_reply_to_account_id
    object.in_reply_to_account_id&.to_s
  end

  # Krews this status is scoped to (via `statuses_krews`). Rich
  # references so consumers can render the named badge without a
  # second round-trip. Empty array for non-krew posts. Ordered by id
  # so repeated renders are stable.
  def krews
    object.krews.reorder(:id).pluck(:id, :slug, :name).map do |id, slug, name|
      { id: id.to_s, slug: slug, name: name }
    end
  end

  def current_user?
    !current_user.nil?
  end

  def show_application?
    object.account.user_shows_application? || (current_user? && current_user.account_id == object.account_id)
  end

  def visibility
    # This visibility is masked behind "private"
    # to avoid API changes because there are no
    # UX differences
    if object.limited_visibility?
      'private'
    else
      object.visibility
    end
  end

  def sensitive
    if current_user? && current_user.account_id == object.account_id
      object.sensitive
    else
      object.account.sensitized? || object.sensitive
    end
  end

  def uri
    ActivityPub::TagManager.instance.uri_for(object)
  end

  def content
    status_content_format(object)
  end

  def url
    ActivityPub::TagManager.instance.url_for(object)
  end

  def reblogs_count
    object.untrusted_reblogs_count || relationships&.attributes_map&.dig(object.id, :reblogs_count) || object.reblogs_count
  end

  def favourites_count
    object.untrusted_favourites_count || relationships&.attributes_map&.dig(object.id, :favourites_count) || object.favourites_count
  end

  def quotes_count
    relationships&.attributes_map&.dig(object.id, :quotes_count) || object.quotes_count
  end

  def favourited
    if relationships
      relationships.favourites_map[object.id] || false
    else
      current_user.account.favourited?(object)
    end
  end

  def reblogged
    if relationships
      relationships.reblogs_map[object.id] || false
    else
      current_user.account.reblogged?(object)
    end
  end

  def muted
    if relationships
      relationships.mutes_map[object.conversation_id] || false
    else
      current_user.account.muting_conversation?(object.conversation)
    end
  end

  def bookmarked
    if relationships
      relationships.bookmarks_map[object.id] || false
    else
      current_user.account.bookmarked?(object)
    end
  end

  def pinned
    if relationships
      relationships.pins_map[object.id] || false
    else
      current_user.account.pinned?(object)
    end
  end

  def filtered
    if relationships
      relationships.filters_map[object.id] || []
    else
      current_user.account.status_matches_filters(object)
    end
  end

  def pinnable?
    current_user? &&
      current_user.account_id == object.account_id &&
      !object.reblog? &&
      StatusRelationshipsPresenter::PINNABLE_VISIBILITIES.include?(object.visibility)
  end

  def source_requested?
    instance_options[:source_requested]
  end

  def ordered_mentions
    object.active_mentions.to_a.sort_by(&:id)
  end

  def quote_approval
    {
      automatic: object.proper.quote_policy_as_keys(:automatic),
      manual: object.proper.quote_policy_as_keys(:manual),
      current_user: object.proper.quote_policy_for_account(current_user&.account),
    }
  end

  private

  def relationships
    instance_options && instance_options[:relationships]
  end

  # Belt-and-braces visibility guards on korner has_one associations
  # that carry their own visibility rules independent of the parent
  # Status. In normal operation the publish services (Albutts::PublishAlbum,
  # Map::PublishTrek) mirror the korner's visibility to the Status, so a
  # Status that passes StatusPolicy#show? has a same-visibility korner
  # attached. These guards defend against a leaked status render
  # (e.g. a caller that skipped the standard filter chain) that would
  # otherwise spill the korner card along with it.
  #
  # Only `album` and `trek` are guarded here — the other korner
  # associations (event, proposal, booth_set, listing, question) derive
  # visibility entirely from the parent Status, so the primary gate
  # already covers them. If a future korner introduces its own visibility
  # ladder (per-record scopes beyond what the Status carries), add a
  # `<korner>_visible_to_viewer?` predicate here too.
  def album_visible_to_viewer?
    object.album.present? && object.album.visible_to?(current_user&.account)
  end

  def trek_visible_to_viewer?
    object.trek.present? && object.trek.visible_to?(current_user&.account)
  end

  class ApplicationSerializer < ActiveModel::Serializer
    attributes :name, :website

    def website
      object.website.presence
    end
  end

  class MentionSerializer < ActiveModel::Serializer
    attributes :id, :username, :url, :acct

    def id
      object.account_id.to_s
    end

    def username
      object.account_username
    end

    def url
      ActivityPub::TagManager.instance.url_for(object.account)
    end

    def acct
      object.account.pretty_acct
    end
  end

  class TagSerializer < ActiveModel::Serializer
    include RoutingHelper

    attributes :name, :url

    def url
      tag_url(object)
    end
  end
end
