# frozen_string_literal: true

# Kommunity — Mates, the landing view: the viewer's own Mates, whoever posted
# most recently first. Tal's Kommons proposal "Kommunity Page"
# (#117596933443323274): "The 'Discover' page shouldn't be the landing page.
# Maybe a list of the users mates should be first page, ordered by most
# recent posts made."
#
#   GET /api/v1/kommunity/mates?q=&limit=&offset=
#
# Every Mate is listed, whatever their findability: findability decides who
# can come across you, and a Mate already has. Suspended, unapproved and
# moved accounts are left out, and so is anyone the viewer has blocked or
# muted. The order is plain time, newest post first (`last_status_at`), never
# a ranking; Mates who have never posted come last, by name. Search and
# offset paging are the Everyone list's.
class Api::V1::Kommunity::MatesController < Api::V1::Kommunity::EveryoneController
  RECENT_ORDER = Arel.sql("account_stats.last_status_at DESC NULLS LAST, #{NAME_ORDER}")

  private

  def visible_scope
    current_account.mates
                   .searchable
                   .without_memorial
                   .not_excluded_by_account(current_account)
                   .left_outer_joins(:account_stat)
  end

  def list_order
    RECENT_ORDER
  end

  def page_url(params)
    api_v1_kommunity_mates_url(params)
  end
end
