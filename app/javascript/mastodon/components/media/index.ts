// Shared media-capture primitives. Any korner composer or chat
// surface that needs to record/upload/play voice memos, or offer
// combined camera+library media picking, imports from here.
//
// Consumers today: Moments (photo+voice, per docs/spaces/moments.md);
// pending: Nudges (revives archived voice sending, PR follow-up),
// Booth/Albutts (media pick unification, opportunistic).
export { MediaPickButtons } from './media_pick_buttons';
export { uploadMediaBlob } from './upload_media_blob';
export type { VoiceRecorderChange } from './voice_recorder';
export { VoiceRecorder } from './voice_recorder';
export { VoicePlayer } from './voice_player';
export { WaveformBars } from './waveform_bars';
export { useVoiceRecording } from './use_voice_recording';
export type {
  VoiceRecordingControls,
  VoiceRecordingOptions,
  VoiceRecordingState,
} from './use_voice_recording';
