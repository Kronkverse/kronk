// KronkOrb — the 3D view at the heart of the Kommunity korner.
//
// A 150-socket Fibonacci sphere; every Kronk-local member occupies a
// socket, coloured and sized by connection count; every follow is a
// quadratic bezier bowing through the sphere's interior. Chords render
// with additive blending so density reads as brightness. The user
// spins with drag, zooms with wheel/pinch, hovers a node for a
// tooltip, and clicks to isolate its neighbourhood.
//
// Design source: KRONK_ORB_DATA_BRIEF.md + kronk-orb.html mockup.
// Geometry is shared with the ambient Kosmos background layer via
// features/kosmos/orb_geometry.ts — the two must never drift.
//
// Standards adherence: no <h1> in this file (SpaceHeader owns the
// title); no tab row (view picker owns it); Kronk tokens only (fog +
// shell tint + empty socket read from CSS custom properties, ramp
// comes through orb_geometry.readOrbPalette). Fonts are Kronk's — the
// mockup's IBM Plex + Playfair Display are guidance, not spec.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import * as THREE from 'three';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import { Icon } from 'mastodon/components/icon';
import {
  buildOrbLayout,
  readOrbPalette,
  SPHERE_RADIUS,
} from 'mastodon/features/kosmos/orb_geometry';
import { useMatesOrb } from 'mastodon/features/kosmos/use_mates_orb';

const AMBIENT_OPACITY = 0.15;
const FOCUS_OPACITY = 0.95;
const CHORD_BEZIER_SEGMENTS = 22; // matches the mockup's SEG
const RADIUS_MIN = SPHERE_RADIUS * 1.12;
const RADIUS_MAX = SPHERE_RADIUS * 7.6;
const RADIUS_INITIAL = SPHERE_RADIUS * 3.3;
const IDLE_DRIFT_RATE = 0.00013; // radians per ms, on theta
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const cssRgb = (name: string, fallback: string): string => {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
};

const hexToNumber = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m?.[1] ? parseInt(m[1], 16) : 0x12131a;
};

interface HoverInfo {
  x: number;
  y: number;
  rank: number;
  connections: number;
  following: number;
  followers: number;
  interconnections: number;
  handle: string;
}

interface NodeRecord {
  id: string;
  // Username is optional — the bundled fallback JSON has opaque `m1`
  // ids without display detail; the live payload from
  // `Api::V1::Kommunity::OrbController` populates it. Tooltip prefers
  // username, falls back to id.
  username?: string;
  rank: number;
  connections: number;
  following: number;
  followers: number;
  interconnections: number;
  // Sprite (not Mesh): the node renders as a camera-facing quad with
  // a circular texture — a coloured disc initially, upgraded to the
  // account's avatar once the image fetch completes. Sprite keeps the
  // disc perpendicular to the camera as the user spins the sphere,
  // so avatars always face the viewer.
  mesh: THREE.Sprite;
  color: THREE.Color;
}

// Render texture resolution for both the placeholder disc and the
// loaded avatar. Bumped 64 → 192 (Tal 2026-08-19 "hard to see the
// profile images on the orb view, they seem faded") — the sprite
// scales to ~10 world units so the previous 64/96px canvases
// upsampled visibly. 192 stays comfortable at sensible zooms.
const TEXTURE_SIZE = 192;

// Ring stroke width (in canvas px) — a bright purple outline lifts
// each disc off the dim void so back-of-sphere nodes still read
// even under fog. Applied identically to placeholders and avatars.
const RING_STROKE = 8;

// Build a solid-colour circular texture on a canvas — the placeholder
// look for a node before its avatar downloads (and the final look for
// nodes whose avatar_url isn't available or fails to load).
const buildCircleTexture = (
  rgb: readonly [number, number, number],
  ringHex: string,
): THREE.CanvasTexture => {
  const size = TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = `rgb(${rgb[0].toString()}, ${rgb[1].toString()}, ${rgb[2].toString()})`;
    ctx.fill();
    drawRing(ctx, size, ringHex);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
};

// A single purple ring inside the disc's outer edge. Drawn on the
// unclipped context so it sits on top of whatever we filled/drew.
const drawRing = (
  ctx: CanvasRenderingContext2D,
  size: number,
  ringHex: string,
): void => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - RING_STROKE / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.strokeStyle = ringHex.startsWith('#') ? ringHex : `#${ringHex}`;
  ctx.lineWidth = RING_STROKE;
  ctx.stroke();
  ctx.restore();
};

// Load an avatar URL and clip it into a circular canvas texture.
// Resolves `null` on any failure (network error, CORS blocking the
// canvas paint) — caller keeps the placeholder disc in that case.
const loadAvatarCircle = (
  url: string,
  ringHex: string,
): Promise<THREE.CanvasTexture | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = TEXTURE_SIZE;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      try {
        ctx.drawImage(img, 0, 0, size, size);
        ctx.restore();
        drawRing(ctx, size, ringHex);
        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;
        resolve(tex);
      } catch {
        // Tainted canvas (CORS): the browser refuses to read pixels
        // back into a texture. Fall through to the placeholder disc.
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });

export const KronkOrb = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const orb = useMatesOrb();
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Exposed by the useEffect below so the popup's close button can
  // clear both React state AND the effect's closure-scoped
  // `currentSelected` in one call (keeps the focus chords + node
  // dimming in sync — otherwise React would forget the selection
  // while the canvas still thought a node was highlighted).
  const clearSelectionRef = useRef<() => void>(() => {
    setSelectedId(null);
  });

  // Look up the selected account so the popup can render name / avatar
  // / stats. Kept in a `useMemo` so a scene re-render (from `hover`
  // updates fluttering the parent) doesn't rescan the account list.
  const selectedAccount = useMemo(() => {
    if (!selectedId || !orb) return null;
    return orb.accounts.find((a) => a.id === selectedId) ?? null;
  }, [selectedId, orb]);

  // Stable close handler for the popup card. `.current` is populated
  // by the useEffect below; a fallback keeps React happy if the
  // handler fires before the effect mounts.
  const handleCardClose = useCallback(() => {
    clearSelectionRef.current();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    // No data yet — the first fetch is still in flight. Skip the
    // whole THREE.js scene build; the effect re-runs when `orb`
    // populates. Prevents the pre-#1338 "glimpse of the bundled
    // 150-node fallback" flash before the (usually smaller) live
    // set arrives.
    if (!orb) return undefined;

    const palette = readOrbPalette();
    const layout = buildOrbLayout(orb, palette);
    const voidHex = cssRgb('--kosmos-void', '#0b0c11');
    const shellTint = cssRgb('--kronk-purple-deep', '#3a2a99');
    const emptySocket = cssRgb('--kronk-purple-muted', '#47368b');
    // Purple stroke around every node disc — see `drawRing`.
    const ringHex = cssRgb('--kronk-purple-bright', '#8a5cf6');

    const scene = new THREE.Scene();
    // Fog density: reduced 0.0034 → 0.002 on 2026-08-19 (Tal
    // reported avatars "seem faded" — exp² fog at 0.0034 dropped
    // back-of-sphere nodes to ~28% brightness at rest; 0.002 keeps
    // them above ~65% so a face still reads even on the far side).
    scene.fog = new THREE.FogExp2(hexToNumber(voidHex), 0.002);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      1,
      4000,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // transparent — the Kosmos layer paints behind
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    const world = new THREE.Group();
    scene.add(world);

    // A soft transparent shell so the sphere reads as an object rather
    // than a cloud of unrelated points.
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS, 64, 48),
      new THREE.MeshBasicMaterial({
        color: hexToNumber(shellTint),
        transparent: true,
        opacity: 0.055,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    world.add(shell);

    // Nodes — one mesh per placed account, sized + coloured by degree.
    const nodeGroup = new THREE.Group();
    const emptyGroup = new THREE.Group();
    world.add(emptyGroup, nodeGroup);

    const nodes: NodeRecord[] = [];
    const byId = new Map<string, NodeRecord>();
    const emptyGeo = new THREE.SphereGeometry(1.15, 8, 6);
    const emptyMat = new THREE.MeshBasicMaterial({
      color: hexToNumber(emptySocket),
      transparent: true,
      opacity: 0.34,
    });

    const usedSocketPositions = new Set<string>();
    // Track baked textures so we can dispose on unmount + on avatar
    // swap. WebGL leaks otherwise.
    const nodeTextures: THREE.Texture[] = [];
    layout.placements.forEach((p) => {
      const rad =
        1.5 +
        2.9 * Math.sqrt(p.connections / Math.max(1, layout.maxConnections));
      const color = new THREE.Color(
        p.col[0] / 255,
        p.col[1] / 255,
        p.col[2] / 255,
      );
      // Placeholder texture: a coloured circle. If the account has an
      // avatar_url we async-load it and swap the texture in place
      // when it arrives. Tainted-canvas / network-failure keeps this
      // disc — sphere never has a blank hole.
      const tex = buildCircleTexture(p.col, ringHex);
      nodeTextures.push(tex);
      // Solid discs (Tal 2026-08-28 — "profile pictures in the orb
      // seem slightly transparent, can we make them solid"). At rest
      // we want zero alpha blending so the avatar reads as an opaque
      // object, not a decal — `transparent: false` disables blending
      // and `alphaTest: 0.5` keeps the disc's circular edge clean by
      // discarding the antialiased fringe pixels rather than
      // half-blending them against the dim void behind. The dim
      // (non-neighbour) selection state below still toggles
      // `transparent: true` + a fractional opacity when needed.
      const material = new THREE.SpriteMaterial({
        map: tex,
        transparent: false,
        alphaTest: 0.5,
        opacity: 1,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(p.pos[0], p.pos[1], p.pos[2]);
      // Sprite scale is world-unit width / height. Multiplier bumped
      // 2 → 2.4 (Tal 2026-08-28 — "also a little bigger please"), so
      // discs read ~20% larger without upsetting the sphere layout.
      sprite.scale.setScalar(rad * 2.4);
      nodeGroup.add(sprite);
      usedSocketPositions.add(`${p.pos[0]},${p.pos[1]},${p.pos[2]}`);
      const acc = orb.accounts.find((a) => a.id === p.id);
      if (!acc) return;
      const record: NodeRecord = {
        id: p.id,
        username: acc.username,
        rank: acc.rank,
        connections: acc.connections,
        following: acc.following,
        followers: acc.followers,
        interconnections: acc.interconnections,
        mesh: sprite,
        color,
      };
      nodes.push(record);
      byId.set(p.id, record);
      if (acc.avatar_url) {
        void loadAvatarCircle(acc.avatar_url, ringHex).then((avatarTex) => {
          if (!avatarTex) return;
          // Swap on the live material — dispose the old placeholder
          // to release its GPU texture memory.
          material.map = avatarTex;
          material.needsUpdate = true;
          tex.dispose();
          nodeTextures.push(avatarTex);
        });
      }
    });

    // Empty sockets — the community's remaining room, shown as dim
    // markers so the sphere reads as a container with capacity, not
    // just a lit graph.
    layout.sockets.forEach((s) => {
      const key = `${s[0]},${s[1]},${s[2]}`;
      if (usedSocketPositions.has(key)) return;
      const m = new THREE.Mesh(emptyGeo, emptyMat);
      m.position.set(s[0], s[1], s[2]);
      emptyGroup.add(m);
    });

    // Adjacency for the focus highlight.
    const outMap = new Map<string, Set<string>>();
    const inMap = new Map<string, Set<string>>();
    orb.follows.forEach(([a, b]) => {
      if (!byId.has(a) || !byId.has(b)) return;
      if (!outMap.has(a)) outMap.set(a, new Set());
      if (!inMap.has(b)) inMap.set(b, new Set());
      outMap.get(a)?.add(b);
      inMap.get(b)?.add(a);
    });

    // Chord geometry builder — used for both the ambient (low-opacity,
    // whole-graph) and focus (bright, one-node's-neighbourhood) lines.
    const buildChordSegments = (
      pairs: readonly (readonly [string, string])[],
      opacity: number,
    ): THREE.LineSegments => {
      const positions: number[] = [];
      const colors: number[] = [];
      const ctrl = new THREE.Vector3();
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      );
      pairs.forEach(([aId, bId]) => {
        const a = byId.get(aId);
        const b = byId.get(bId);
        if (!a || !b) return;
        ctrl
          .addVectors(a.mesh.position, b.mesh.position)
          .multiplyScalar(0.5)
          .multiplyScalar(0.52);
        curve.v0 = a.mesh.position;
        curve.v1 = ctrl;
        curve.v2 = b.mesh.position;
        const pts = curve.getPoints(CHORD_BEZIER_SEGMENTS);
        for (let i = 0; i < CHORD_BEZIER_SEGMENTS; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          if (!p0 || !p1) continue;
          positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
          const c0 = a.color.clone().lerp(b.color, i / CHORD_BEZIER_SEGMENTS);
          const c1 = a.color
            .clone()
            .lerp(b.color, (i + 1) / CHORD_BEZIER_SEGMENTS);
          colors.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b);
        }
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3),
      );
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.LineSegments(geometry, material);
    };

    const ambientLines: THREE.LineSegments = buildChordSegments(
      orb.follows,
      AMBIENT_OPACITY,
    );
    world.add(ambientLines);

    let focusLines: THREE.LineSegments = buildChordSegments([], FOCUS_OPACITY);
    world.add(focusLines);

    // Camera orbit — hand-rolled to avoid pulling in three's controls
    // examples module (a whole extra bundle). theta = longitude,
    // phi = latitude (clamped away from the poles), radius = distance.
    const cam = { theta: 0.6, phi: 1.15, radius: RADIUS_INITIAL };
    const target = { ...cam };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let hoveredId: string | null = null;
    let idleUntouched = true;

    const reducedMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    let reduced = reducedMedia.matches;
    const onReducedChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
    };
    reducedMedia.addEventListener('change', onReducedChange);

    const el = renderer.domElement;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      idleUntouched = false;
      lastX = event.clientX;
      lastY = event.clientY;
      el.setPointerCapture(event.pointerId);
      el.style.cursor = 'grabbing';
    };
    const onPointerMove = (event: PointerEvent) => {
      handleHover(event);
      if (!dragging) return;
      target.theta -= (event.clientX - lastX) * 0.006;
      target.phi = Math.max(
        0.08,
        Math.min(Math.PI - 0.08, target.phi - (event.clientY - lastY) * 0.006),
      );
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
      el.style.cursor = hoveredId ? 'pointer' : 'grab';
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      idleUntouched = false;
      target.radius = Math.max(
        RADIUS_MIN,
        Math.min(
          RADIUS_MAX,
          target.radius * (1 + Math.sign(event.deltaY) * 0.1),
        ),
      );
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    // Pinch-zoom support (touch — two-finger distance change).
    let pinch = 0;
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const t0 = event.touches[0];
      const t1 = event.touches[1];
      if (!t0 || !t1) return;
      const d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      if (pinch) {
        idleUntouched = false;
        target.radius = Math.max(
          RADIUS_MIN,
          Math.min(RADIUS_MAX, target.radius * (pinch / d)),
        );
      }
      pinch = d;
    };
    const onTouchEnd = () => {
      pinch = 0;
    };
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);

    // Raycasting for hover + click.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const handleHover = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(nodeGroup.children, false)[0];
      const record = hit ? nodes.find((n) => n.mesh === hit.object) : null;
      if (record) {
        hoveredId = record.id;
        if (!dragging) el.style.cursor = 'pointer';
        setHover({
          x: event.clientX,
          y: event.clientY,
          rank: record.rank,
          connections: record.connections,
          following: record.following,
          followers: record.followers,
          interconnections: record.interconnections,
          // Live payload gives a real handle; bundled fallback (opaque
          // `m1` ids) falls back to the id itself.
          handle: record.username ? `@${record.username}` : record.id,
        });
      } else {
        hoveredId = null;
        if (!dragging) el.style.cursor = 'grab';
        setHover(null);
      }
    };

    const onClick = () => {
      if (hoveredId) {
        setSelectedIdRef(hoveredId);
      } else {
        setSelectedIdRef(null);
      }
    };
    el.addEventListener('click', onClick);

    // Focus highlight — dim non-neighbours, redraw the focus chord set.
    // We keep the current selection in a ref-shaped closure so the loop
    // and click handler agree without triggering a rebuild.
    let currentSelected: string | null = null;
    const setSelectedIdRef = (id: string | null) => {
      currentSelected = id;
      setSelectedId(id);
      applyFocus();
    };
    // Bridge for the React-side close button: calling this from
    // outside the effect clears the canvas focus AND the React state
    // in one go, keeping the two in sync.
    clearSelectionRef.current = () => {
      setSelectedIdRef(null);
    };

    const applyFocus = () => {
      world.remove(focusLines);
      focusLines.geometry.dispose();
      if (focusLines.material instanceof THREE.Material)
        focusLines.material.dispose();

      const sel = currentSelected;
      const pairs: [string, string][] = [];
      if (sel) {
        outMap.get(sel)?.forEach((b) => {
          pairs.push([sel, b]);
        });
        inMap.get(sel)?.forEach((a) => {
          pairs.push([a, sel]);
        });
      }
      focusLines = buildChordSegments(pairs, FOCUS_OPACITY);
      world.add(focusLines);

      const neighbourhood = new Set<string>();
      if (sel) {
        neighbourhood.add(sel);
        outMap.get(sel)?.forEach((b) => neighbourhood.add(b));
        inMap.get(sel)?.forEach((a) => neighbourhood.add(a));
      }
      nodes.forEach((n) => {
        const mat = n.mesh.material;
        // Sprite always carries SpriteMaterial; keep the check so a
        // typed mat lets us touch opacity/transparent without a cast.
        if (!(mat instanceof THREE.SpriteMaterial)) return;
        const lit = !sel || neighbourhood.has(n.id);
        // Only flip on alpha blending when we actually need a
        // fractional opacity for the dim state — leaving
        // `transparent: true` on at rest brings back the faded look
        // the solid-disc fix above is trying to kill.
        mat.transparent = !lit;
        mat.opacity = lit ? 1 : 0.22;
        // Sprite's base scale is set at build-time (rad*2); the
        // highlight multiplies from that baseline via `setScalar`
        // — matches the Mesh behaviour it replaces since both use
        // scale.x/y/z uniformly.
        const baseScale =
          n.mesh.userData.baseScale === undefined
            ? n.mesh.scale.x
            : (n.mesh.userData.baseScale as number);
        n.mesh.userData.baseScale = baseScale;
        const factor = n.id === sel ? 1.7 : lit ? 1 : 0.8;
        n.mesh.scale.setScalar(baseScale * factor);
      });
      const ambMat = ambientLines.material;
      if (ambMat instanceof THREE.LineBasicMaterial) {
        ambMat.opacity = sel ? 0.05 : AMBIENT_OPACITY;
      }
    };

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let raf = 0;
    let lastFrame = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(120, now - lastFrame);
      lastFrame = now;

      // Idle drift — the sphere slowly rotates when untouched, so the
      // depth cue reads even before the user grabs it. Reduced motion
      // disables the drift entirely; interaction cancels it.
      if (!reduced && idleUntouched && !dragging) {
        target.theta += IDLE_DRIFT_RATE * dt;
      }

      // Ease camera state toward target.
      const ease = 0.14;
      cam.theta += (target.theta - cam.theta) * ease;
      cam.phi += (target.phi - cam.phi) * ease;
      cam.radius += (target.radius - cam.radius) * ease;

      camera.position.setFromSphericalCoords(cam.radius, cam.phi, cam.theta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('click', onClick);
      reducedMedia.removeEventListener('change', onReducedChange);
      renderer.dispose();
      shell.geometry.dispose();
      if (shell.material instanceof THREE.Material) shell.material.dispose();
      nodes.forEach((n) => {
        // Sprite's geometry is a shared static (see three/src/objects/
        // Sprite) — disposing it would break every other sprite in
        // the app, so only the material comes out here. Material
        // holds `.map` which we dispose via `nodeTextures` below.
        if (n.mesh.material instanceof THREE.Material)
          n.mesh.material.dispose();
      });
      nodeTextures.forEach((t) => {
        t.dispose();
      });
      emptyGeo.dispose();
      emptyMat.dispose();
      ambientLines.geometry.dispose();
      if (ambientLines.material instanceof THREE.Material)
        ambientLines.material.dispose();
      focusLines.geometry.dispose();
      if (focusLines.material instanceof THREE.Material)
        focusLines.material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [orb]);

  return (
    <div className='kronk-orb'>
      <div ref={containerRef} className='kronk-orb__stage' />
      {hover && (
        <div
          className='kronk-orb__tooltip'
          style={{ left: hover.x + 14, top: hover.y + 16 }}
          role='tooltip'
        >
          <div className='kronk-orb__tooltip-rank'>Rank {hover.rank}</div>
          <div className='kronk-orb__tooltip-line'>
            {hover.connections} connected · {hover.following}↗{' '}
            {hover.followers}↙
          </div>
          <div className='kronk-orb__tooltip-line'>
            {hover.interconnections} mutual
          </div>
        </div>
      )}
      {!selectedId && (
        <div className='kronk-orb__hint'>
          Drag to spin · scroll to zoom · click a node
        </div>
      )}
      {selectedAccount && (
        <div
          className='kronk-orb__card'
          role='dialog'
          aria-label='Selected member'
        >
          <button
            type='button'
            className='kronk-orb__card-close'
            onClick={handleCardClose}
            aria-label='Close'
          >
            <Icon id='close' icon={CloseIcon} />
          </button>
          <div className='kronk-orb__card-head'>
            {selectedAccount.avatar_url ? (
              <img
                className='kronk-orb__card-avatar'
                src={selectedAccount.avatar_url}
                alt=''
              />
            ) : (
              <div className='kronk-orb__card-avatar kronk-orb__card-avatar--placeholder' />
            )}
            <div className='kronk-orb__card-identity'>
              {selectedAccount.display_name && (
                <div className='kronk-orb__card-name'>
                  {selectedAccount.display_name}
                </div>
              )}
              {selectedAccount.username && (
                <div className='kronk-orb__card-handle'>
                  @{selectedAccount.username}
                </div>
              )}
            </div>
          </div>
          <div className='kronk-orb__card-stats'>
            <span className='kronk-orb__card-rank'>
              Rank {selectedAccount.rank}
            </span>
            <span>{selectedAccount.connections} connected</span>
            <span>
              {selectedAccount.following}↗ {selectedAccount.followers}↙
            </span>
            <span>{selectedAccount.interconnections} mutual</span>
          </div>
          {selectedAccount.username && (
            <Link
              to={`/@${selectedAccount.username}`}
              className='kronk-orb__card-visit'
            >
              View profile
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
