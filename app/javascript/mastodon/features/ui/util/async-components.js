export function EmojiPicker () {
  return import('../../emoji/emoji_picker');
}

export function Compose () {
  return import('../../compose');
}

export function HomeTimeline () {
  return import('../../home_timeline');
}

export function Firehose () {
  return import('../../firehose');
}

export function HashtagTimeline () {
  return import('../../hashtag_timeline');
}

export function Status () {
  return import('../../status');
}

export function GettingStarted () {
  return import('../../getting_started');
}

export function KeyboardShortcuts () {
  return import('../../keyboard_shortcuts');
}

export function PinnedStatuses () {
  return import('../../pinned_statuses');
}

export function AccountTimeline () {
  return import('../../account_timeline');
}

export function AccountGallery () {
  return import('../../account_gallery');
}

export function AccountNudges () {
  return import('../../account_nudges');
}

export function AccountFeatured() {
  return import('../../account_featured');
}

export function Followers () {
  return import('../../followers');
}

export function Following () {
  return import('../../following');
}

export function Reblogs () {
  return import('../../reblogs');
}

export function Favourites () {
  return import('../../favourites');
}

export function Quotes () {
  return import('../../quotes');
}

export function FollowRequests () {
  return import('../../follow_requests');
}

export function FavouritedStatuses () {
  return import('../../favourited_statuses');
}

export function FollowedTags () {
  return import('../../followed_tags');
}

export function BookmarkedStatuses () {
  return import('../../bookmarked_statuses');
}

export function Blocks () {
  return import('../../blocks');
}

export function DomainBlocks () {
  return import('../../domain_blocks');
}

export function Mutes () {
  return import('../../mutes');
}

export function MuteModal () {
  return import('../components/mute_modal');
}

export function BlockModal () {
  return import('../components/block_modal');
}

export function DomainBlockModal () {
  return import('../components/domain_block_modal');
}

export function ReportModal () {
  return import('../components/report_modal');
}

export function IgnoreNotificationsModal () {
  return import('../components/ignore_notifications_modal');
}

export function MediaGallery () {
  return import('../../../components/media_gallery');
}

export function Video () {
  return import('../../video');
}

export function EmbedModal () {
  return import('../components/embed_modal');
}

export function ListAdder () {
  return import('../../list_adder');
}

export function Tesseract () {
  return import('tesseract.js');
}

export function Audio () {
  return import('../../audio');
}

export function Directory () {
  return import('../../directory');
}

export function OnboardingProfile () {
  return import('../../onboarding/profile');
}

export function OnboardingFollows () {
  return import('../../onboarding/follows');
}

export function CompareHistoryModal () {
  return import('../components/compare_history_modal');
}

export function Explore () {
  return import('../../explore');
}

export function FilterModal () {
  return import('../components/filter_modal');
}

export function InteractionModal () {
  return import('../../interaction_modal');
}

export function SubscribedLanguagesModal () {
  return import('../../subscribed_languages_modal');
}

export function ClosedRegistrationsModal () {
  return import('../../closed_registrations_modal');
}

export function About () {
  return import('../../about');
}

export function PrivacyPolicy () {
  return import('../../privacy_policy');
}

export function TermsOfService () {
  return import('../../terms_of_service');
}

export function NotificationRequests () {
  return import('../../notifications/requests');
}

export function NotificationRequest () {
  return import('../../notifications/request');
}

export function LinkTimeline () {
  return import('../../link_timeline');
}

export function AnnualReportModal () {
  return import('../components/annual_report_modal');
}

export function Orbit () {
  return import("../../activity");
}

export function Live () {
  return import("../../live");
}

export function Events () {
  return import("../../events").then(m => ({ default: m.Events }));
}

export function Inflow () {
  return import("../../inflow").then(m => ({ default: m.Inflow }));
}

export function Nudges () {
  // Phase 1b: /nudges renders the Signal-shaped messenger shell.
  // Legacy features/nudges (partner-based 1:1 view) retires with the
  // legacy notification-bell view in the same sunset window.
  return import("../../nudges_messenger");
}


export function EventDetail () {
  return import("../../events/event_detail").then(m => ({ default: m.EventDetail }));
}


export function Governance () {
  return import("../../governance").then(m => ({ default: m.Governance }));
}

export function KommonsProposal () {
  return import("../../governance/proposal_page").then(m => ({ default: m.ProposalPage }));
}

export function KommonsSpace () {
  return import("../../governance/space_page").then(m => ({ default: m.SpacePage }));
}

export function KommonsNodeMeta () {
  return import("../../governance/node_meta_page").then(m => ({ default: m.NodeMetaPage }));
}

export function KommonsPropose () {
  return import("../../governance/propose_page").then(m => ({ default: m.ProposePage }));
}

export function KommonsProposePicker () {
  return import("../../governance/propose_picker").then(m => ({ default: m.ProposePicker }));
}


export function KommonsLattice () {
  return import("../../kommons_lattice");
}


export function KronkSearch () {
  return import("../../kronk_search");
}


export function YouPortal () {
  return import("../../you_portal");
}


export function Questions () {
  return import("../../questions").then(m => ({ default: m.Questions }));
}

export function Booth () {
  return import("../../booth");
}

export function BoothSetPage () {
  return import("../../booth/booth_set_page");
}

export function ProfileSectionsSettings () {
  return import("../../profile_sections_settings").then(m => ({ default: m.ProfileSectionsSettings }));
}

export function SectionedProfile () {
  return import("../../sectioned_profile").then(m => ({ default: m.SectionedProfile }));
}

export function NudgesLegacyArchive () {
  return import("../../nudges_legacy").then(m => ({ default: m.NudgesLegacyArchive }));
}

export function Krews () {
  return import("../../krew").then(m => ({ default: m.Krews }));
}

export function Wachuneed () {
  return import("../../wachuneed");
}

export function KrewDetail () {
  return import("../../krew/krew_detail").then(m => ({ default: m.KrewDetail }));
}

export function KrewNew () {
  return import("../../krew/krew_new").then(m => ({ default: m.KrewNew }));
}

export function Hub () {
  return import("../../hub").then(m => ({ default: m.Hub }));
}

export function KalendarSpiral () {
  return import("../../kalendar_spiral");
}

export function WachuneedV2 () {
  return import("../../wachuneed_v2");
}

export function InflowV2 () {
  return import("../../inflow_v2");
}

export function MapV2 () {
  return import("../../map_v2");
}

export function MomentsStub () {
  return import("../../korner_stub").then(m => ({ default: m.MomentsStub }));
}

export function AlbuttsStub () {
  return import("../../korner_stub").then(m => ({ default: m.AlbuttsStub }));
}

export function MapStub () {
  return import("../../korner_stub").then(m => ({ default: m.MapStub }));
}

export function KornerSettings () {
  return import("../../korner_settings").then(m => ({ default: m.KornerSettings }));
}

export function ProfileCompose () {
  return import("../../profile_compose").then(m => ({ default: m.ProfileCompose }));
}

export function FeedSettings () {
  return import("../../feed_settings").then(m => ({ default: m.FeedSettings }));
}

export function Connections () {
  return import("../../connections").then(m => ({ default: m.Connections }));
}

export function StyleGuide () {
  return import("../../styleguide").then(m => ({ default: m.StyleGuide }));
}

export function SettingsHub () {
  return import("../../settings_hub").then(m => ({ default: m.SettingsHub }));
}

export function AppearanceSettings () {
  return import("../../appearance_settings").then(m => ({ default: m.AppearanceSettings }));
}

export function PostingSettings () {
  return import("../../posting_settings");
}

export function NotificationsSettings () {
  return import("../../notifications_settings").then(m => ({ default: m.NotificationsSettings }));
}

export function PrivacySettings () {
  return import("../../privacy_settings").then(m => ({ default: m.PrivacySettings }));
}

export function SettingsYou () {
  return import("../../settings_you").then(m => ({ default: m.SettingsYou }));
}

export function SettingsKorners () {
  return import("../../settings_korners").then(m => ({ default: m.SettingsKorners }));
}

