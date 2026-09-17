// See app/serializers/rest/relationship_serializer.rb
export interface ApiRelationshipJSON {
  blocked_by: boolean;
  blocking: boolean;
  domain_blocking: boolean;
  endorsed: boolean;
  followed_by: boolean;
  following: boolean;
  id: string;
  languages: string[] | null;
  mate: boolean;
  muting_notifications: boolean;
  muting: boolean;
  note: string;
  notifying: boolean;
  // Kronk — can the viewer see this account's profile content (its bio,
  // shelves and told-cards)? False when the account's profile_visibility
  // reach scope excludes the viewer; the profile page then shows only the
  // name + avatar and a "become Mates to see more" prompt.
  profile_visible: boolean;
  requested_by: boolean;
  requested: boolean;
  showing_reblogs: boolean;
}
