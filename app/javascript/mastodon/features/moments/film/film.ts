// Film looks for Moments photos. A port of `lutgen.py` (the reference
// that produced `film_family.json` and the approved contact sheet): the
// same maths, run per pixel in a WebGL fragment shader instead of being
// baked into a .cube LUT, so there are no LUT files and no 3D-texture
// interpolation error. Keep this and `lutgen.py` in step: if a step
// changes in one, change it in the other.
//
// The look is baked into the photo before upload (`applyFilmToFile`);
// the server only ever sees the finished JPEG.

import spec from './film_family.json';

interface HueShift {
  hue: number;
  width: number;
  shift?: number;
  sat?: number;
}

type Vec3 = [number, number, number];

interface FilmParams {
  exposure: number;
  warmth: number;
  tint: number;
  contrast: number;
  pivot: number;
  channel_contrast: Vec3;
  channel_pivot: Vec3;
  black: number;
  white: number;
  saturation: number;
  sat_shadow_rolloff: number;
  sat_highlight_rolloff: number;
  density: number;
  hue_shifts: HueShift[];
  shadow_tint: Vec3;
  highlight_tint: Vec3;
  mono: Vec3 | null;
}

// Same defaults as DEFAULTS in lutgen.py (`size` only matters for .cube).
const DEFAULTS: FilmParams = {
  exposure: 0,
  warmth: 0,
  tint: 0,
  contrast: 1,
  pivot: 0.42,
  channel_contrast: [1, 1, 1],
  channel_pivot: [0, 0, 0],
  black: 0,
  white: 1,
  saturation: 1,
  sat_shadow_rolloff: 0,
  sat_highlight_rolloff: 0,
  density: 0,
  hue_shifts: [],
  shadow_tint: [0, 0, 0],
  highlight_tint: [0, 0, 0],
  mono: null,
};

interface LookSpec extends Partial<FilmParams> {
  name: string;
  description: string;
}

const specLooks = spec.looks as LookSpec[];

export interface FilmLook {
  id: string;
  description: string;
  params: FilmParams;
}

// DEFAULTS <- spec.base <- look, as build_params() does.
export const FILM_LOOKS: readonly FilmLook[] = specLooks.map((look) => {
  const { name, description, ...overrides } = look;
  return {
    id: name,
    description,
    params: {
      ...DEFAULTS,
      ...(spec.base as Partial<FilmParams>),
      ...overrides,
    },
  };
});

export const getFilmLook = (id: string): FilmLook | undefined =>
  FILM_LOOKS.find((l) => l.id === id);

// ── shader ───────────────────────────────────────────────────────────

const num = (n: number): string => {
  const s = n.toString();
  return /[.e]/.test(s) ? s : `${s}.0`;
};
const vec3 = (v: Vec3): string => `vec3(${v.map(num).join(', ')})`;

const VERTEX = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const COMMON = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 srgbToLinear(vec3 x) {
  x = max(x, 0.0);
  return mix(pow((x + 0.055) / 1.055, vec3(2.4)), x / 12.92, step(x, vec3(0.04045)));
}
vec3 linearToSrgb(vec3 x) {
  x = max(x, 0.0);
  return mix(1.055 * pow(x, vec3(1.0 / 2.4)) - 0.055, x * 12.92, step(x, vec3(0.0031308)));
}
float filmCurve(float x, float k, float p) {
  float s0 = 1.0 / (1.0 + exp(-k * (0.0 - p)));
  float s1 = 1.0 / (1.0 + exp(-k * (1.0 - p)));
  float s = 1.0 / (1.0 + exp(-k * (x - p)));
  return (s - s0) / (s1 - s0);
}
vec3 rgbToHsv(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float d = mx - mn;
  float dd = d > 1e-8 ? d : 1.0;
  float h;
  if (mx == c.r) h = mod((c.g - c.b) / dd, 6.0);
  else if (mx == c.g) h = (c.b - c.r) / dd + 2.0;
  else h = (c.r - c.g) / dd + 4.0;
  h = d > 1e-8 ? h * 60.0 : 0.0;
  float s = mx > 1e-8 ? d / mx : 0.0;
  return vec3(h, s, mx);
}
vec3 hsvToRgb(float h, float s, float v) {
  h = mod(h, 360.0) / 60.0;
  float i = mod(floor(h), 6.0);
  float f = h - floor(h);
  float p = v * (1.0 - s);
  float q = v * (1.0 - s * f);
  float t = v * (1.0 - s * (1.0 - f));
  if (i < 0.5) return vec3(v, t, p);
  if (i < 1.5) return vec3(q, v, p);
  if (i < 2.5) return vec3(p, v, t);
  if (i < 3.5) return vec3(p, q, v);
  if (i < 4.5) return vec3(t, p, v);
  return vec3(v, p, q);
}
`;

// One program per look, with the parameters written in as constants.
const fragmentFor = (P: FilmParams): string => {
  const hue = P.hue_shifts
    .map(
      (hs) => `
    dist = mod(h - ${num(hs.hue)} + 180.0, 360.0) - 180.0;
    wgt = exp(-0.5 * pow(dist / ${num(hs.width)}, 2.0));
    dh += wgt * ${num(hs.shift ?? 0)};
    sm *= 1.0 + wgt * (${num(hs.sat ?? 1)} - 1.0);`,
    )
    .join('');

  const colour = P.mono
    ? `
  float wsum = ${num(P.mono[0] + P.mono[1] + P.mono[2])};
  float mono = dot(c, ${vec3(P.mono)}) / wsum;
  c = vec3(mono);`
    : `
  ${
    P.hue_shifts.length > 0
      ? `{
    vec3 hsv = rgbToHsv(clamp(c, 0.0, 1.0));
    float h = hsv.x;
    float dh = 0.0;
    float sm = 1.0;
    float dist;
    float wgt;${hue}
    c = hsvToRgb(h + dh, clamp(hsv.y * sm, 0.0, 1.0), hsv.z);
  }`
      : ''
  }
  float L0 = dot(c, LUMA);
  float sat = ${num(P.saturation)} * (1.0
    - ${num(P.sat_shadow_rolloff)} * (1.0 - smoothstep(0.0, 0.3, L0))
    - ${num(P.sat_highlight_rolloff)} * smoothstep(0.6, 1.0, L0));
  c = vec3(L0) + (c - vec3(L0)) * max(sat, 0.0);
  float chroma = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = c * (1.0 - ${num(P.density)} * chroma);`;

  return `${COMMON}
void main() {
  vec3 rgb = texture2D(u_tex, v_uv).rgb;

  // 1. exposure and white balance, in linear light
  vec3 lin = srgbToLinear(rgb) * ${num(2 ** P.exposure)};
  lin *= vec3(${num(1 + P.warmth)}, ${num(1 + P.tint)}, ${num(1 - P.warmth)});
  vec3 x = clamp(linearToSrgb(lin), 0.0, 1.5);

  // 2. film curve per channel (differences between channels = crossover)
  vec3 k = 5.0 * ${num(P.contrast)} * ${vec3(P.channel_contrast)};
  vec3 p = ${num(P.pivot)} + ${vec3(P.channel_pivot)};
  vec3 c = vec3(
    filmCurve(x.r, k.r, p.r),
    filmCurve(x.g, k.g, p.g),
    filmCurve(x.b, k.b, p.b));
  c = ${num(P.black)} + (${num(P.white)} - ${num(P.black)}) * c;

  // 3. colour
  ${colour}

  // 4. split toning
  float L = dot(c, LUMA);
  float ws = 1.0 - smoothstep(0.0, 0.5, L);
  float wh = smoothstep(0.5, 1.0, L);
  c += ws * ${vec3(P.shadow_tint)} + wh * ${vec3(P.highlight_tint)};
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
};

const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('film: could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      `film: shader failed: ${gl.getShaderInfoLog(shader) ?? ''}`,
    );
  }
  return shader;
};

// ── rendering ────────────────────────────────────────────────────────

/** Preview size cap; the posted photo is capped at `POST_MAX_EDGE`. */
export const PREVIEW_MAX_EDGE = 1280;
export const POST_MAX_EDGE = 4096;

const decode = async (source: Blob, maxEdge: number): Promise<ImageBitmap> => {
  // `from-image` applies the EXIF rotation phone photos rely on.
  const full = await createImageBitmap(source, {
    imageOrientation: 'from-image',
  });
  const scale = Math.min(1, maxEdge / Math.max(full.width, full.height));
  if (scale === 1) return full;
  const resized = await createImageBitmap(full, {
    resizeWidth: Math.round(full.width * scale),
    resizeHeight: Math.round(full.height * scale),
    resizeQuality: 'high',
  });
  full.close();
  return resized;
};

/**
 * Draw `bitmap` through a look and return a 2D canvas holding the result.
 * The GL context is released straight away so a long strip of photos
 * never holds more than one.
 */
const renderToCanvas = (
  bitmap: ImageBitmap,
  look: FilmLook,
): HTMLCanvasElement => {
  const glCanvas = document.createElement('canvas');
  glCanvas.width = bitmap.width;
  glCanvas.height = bitmap.height;
  const gl = glCanvas.getContext('webgl', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error('film: WebGL unavailable');
  if (
    bitmap.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
    bitmap.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)
  ) {
    throw new Error('film: image larger than the GPU supports');
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(
    program,
    compile(gl, gl.FRAGMENT_SHADER, fragmentFor(look.params)),
  );
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('film: program failed to link');
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

  gl.viewport(0, 0, bitmap.width, bitmap.height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const out = document.createElement('canvas');
  out.width = bitmap.width;
  out.height = bitmap.height;
  out.getContext('2d')?.drawImage(glCanvas, 0, 0);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return out;
};

/** A graded copy of a photo for the composer's hero preview. */
export const renderFilmPreview = async (
  file: Blob,
  lookId: string,
): Promise<HTMLCanvasElement> => {
  const look = getFilmLook(lookId);
  if (!look) throw new Error(`film: unknown look ${lookId}`);
  const bitmap = await decode(file, PREVIEW_MAX_EDGE);
  try {
    return renderToCanvas(bitmap, look);
  } finally {
    bitmap.close();
  }
};

/** Bake a look into a photo; returns a JPEG `File` ready to upload. */
export const applyFilmToFile = async (
  file: File,
  lookId: string,
): Promise<File> => {
  const look = getFilmLook(lookId);
  if (!look) throw new Error(`film: unknown look ${lookId}`);
  const bitmap = await decode(file, POST_MAX_EDGE);
  try {
    const canvas = renderToCanvas(bitmap, look);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });
    if (!blob) throw new Error('film: could not encode the photo');
    const base = file.name.replace(/\.[^.]+$/, '') || 'moment';
    return new File([blob], `${base}-${look.id}.jpg`, { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
};
