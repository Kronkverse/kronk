import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
} from 'mediabunny';

// Shrinks a phone video on the device before it is uploaded (Kommons "Video
// and photo upload"). A minute of phone video is 100 MB or more, and on a
// phone connection that takes long enough to fail; the server transcodes
// every video to 720p-ish H.264 anyway, so sending more than that only costs
// time. The browser's own encoder (WebCodecs, through mediabunny) re-encodes
// it to at most 1280px on the long side at about 2.5 Mbit/s.
//
// Best effort, always: no WebCodecs, a codec the browser can't decode or
// encode, any error, or a result that isn't clearly smaller, and the original
// goes up unchanged, as it did before.
//
// Loaded on demand by api.ts only when a video is being uploaded, so the
// library stays out of the main bundle.

// Below this a video uploads quickly enough as it is.
const MIN_BYTES = 20 * 1024 * 1024;
const LONG_SIDE = 1280;
const VIDEO_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;

export const shrinkVideo = async (file: File): Promise<File> => {
  if (file.size < MIN_BYTES || typeof VideoEncoder === 'undefined') {
    return file;
  }

  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(file),
    });
    const track = await input.getPrimaryVideoTrack();
    if (!track) return file;

    const [width, height] = await Promise.all([
      track.getDisplayWidth(),
      track.getDisplayHeight(),
    ]);
    const landscape = width >= height;
    const longSide = landscape ? width : height;
    const size =
      longSide > LONG_SIDE
        ? landscape
          ? { width: LONG_SIDE }
          : { height: LONG_SIDE }
        : {};

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });

    const conversion = await Conversion.init({
      input,
      output,
      video: { ...size, codec: 'avc', bitrate: VIDEO_BITRATE },
      audio: { codec: 'aac', bitrate: AUDIO_BITRATE },
      showWarnings: false,
    });

    // A video track the browser can't re-encode would be dropped, leaving
    // sound only: send the original instead.
    const lostVideo = conversion.discardedTracks.some(
      (discarded) => discarded.track.type === 'video',
    );
    if (!conversion.isValid || lostVideo) return file;

    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength > file.size * 0.8) return file;

    const name = file.name.replace(/\.[^.]*$/, '') || 'video';
    return new File([buffer], `${name}.mp4`, { type: 'video/mp4' });
  } catch {
    return file;
  }
};
