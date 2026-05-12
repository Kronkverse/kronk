import { useCallback, useEffect, useRef, useState } from 'react';

import { useHistory } from 'react-router-dom';

import {
  IconCalendar,
  IconHome,
  IconMessageCircle,
  IconSeedling,
  IconShoppingBag,
} from '@tabler/icons-react';

// ── Design tokens (Hub spec) ───────────────────────────────────────────────
const BRAND_PURPLE = '#563ACC';
const PAGE_BG = '#0A0E1A';
const CARD_BG = '#13162A';
const CARD_BORDER = '#2A2D45';
const SOL_BODY = '#B5A7E5';
const SOL_GLYPH = '#3D2A8C';
const SATURN_RINGS = '#8B7CD0';
const TEXT_PRIMARY = '#E8E6F5';
const TEXT_SECONDARY = '#9A95B8';
const GLYPH_FILL = '#E5D9F5';
const PLANET_LABEL = '#A89CCE';
const SOL_LABEL = '#C5BAEB';
const ORBITS = '#28204A';
const SECTOR_LINES = '#2D2552';
const STARS_COLOR = '#DBCEED';
const ACCENT_TEXT = '#A498ED';

// ── Constants ──────────────────────────────────────────────────────────────
const BASE_W = 800;
const BASE_H = 1300;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.0;
const WHEEL_ZOOM = 1.7;
const SPACING = 90;
const MOON_OFFSET_X = 80;
const SHIFT_X = 440;
const PLANET_ORDER = [
  'Mercury',
  'Venus',
  'Earth',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];

const ORBIT_RADII = [60, 92, 122, 152, 200, 240, 280, 310, 340];

interface Planet {
  name: string;
  glyph: string;
  meaning: string;
  cx: number;
  cy: number;
  bodyR: number;
  haloR: number;
  isSol?: boolean;
  hasRings?: boolean;
}

const PLANETS: Planet[] = [
  {
    name: 'Sol',
    glyph: '☉︎',
    meaning: 'the inner workings of self',
    cx: 400,
    cy: 400,
    bodyR: 30,
    haloR: 38,
    isSol: true,
  },
  {
    name: 'Mercury',
    glyph: '☿︎',
    meaning: 'expression · learn, share, speak truth',
    cx: 430,
    cy: 348,
    bodyR: 14,
    haloR: 26,
  },
  {
    name: 'Venus',
    glyph: '♀︎',
    meaning: 'love · heart, intimacy, relation',
    cx: 340.8,
    cy: 329.5,
    bodyR: 15,
    haloR: 28,
  },
  {
    name: 'Earth',
    glyph: '♁︎',
    meaning: 'roots · nature, lineage, the primal',
    cx: 285.3,
    cy: 441.7,
    bodyR: 15,
    haloR: 28,
  },
  {
    name: 'Mars',
    glyph: '♂︎',
    meaning: 'stance · what you fight for',
    cx: 452,
    cy: 542.9,
    bodyR: 14,
    haloR: 26,
  },
  {
    name: 'Jupiter',
    glyph: '♃︎',
    meaning: 'sovereignty · governance, answers',
    cx: 573.2,
    cy: 300,
    bodyR: 22,
    haloR: 34,
  },
  {
    name: 'Saturn',
    glyph: '♄︎',
    meaning: 'reckoning · justice, consequence',
    cx: 317.9,
    cy: 174.4,
    bodyR: 19,
    haloR: 32,
    hasRings: true,
  },
  {
    name: 'Uranus',
    glyph: '♅︎',
    meaning: 'revolution · where we aim',
    cx: 120,
    cy: 400,
    bodyR: 17,
    haloR: 30,
  },
  {
    name: 'Neptune',
    glyph: '♆︎',
    meaning: 'ritual · magic, presence, ceremony',
    cx: 245,
    cy: 668.5,
    bodyR: 17,
    haloR: 30,
  },
  {
    name: 'Pluto',
    glyph: '♇︎',
    meaning: 'the edge',
    cx: 719.6,
    cy: 516.3,
    bodyR: 13,
    haloR: 24,
  },
];

const MOONS = [
  {
    space: 'Feed',
    parent: 'Mercury',
    cx: 430,
    cy: 296,
    route: '/',
    Icon: IconHome,
    tetherFrom: { x: 430, y: 322 },
    tetherTo: { x: 430, y: 312 },
  },
  {
    space: 'Huddle',
    parent: 'Venus',
    cx: 340.8,
    cy: 393,
    route: null,
    Icon: IconMessageCircle,
    tetherFrom: { x: 340.8, y: 357.5 },
    tetherTo: { x: 340.8, y: 375 },
  },
  {
    space: 'Market',
    parent: 'Earth',
    cx: 285.3,
    cy: 386,
    route: null,
    Icon: IconShoppingBag,
    tetherFrom: { x: 285.3, y: 413.7 },
    tetherTo: { x: 285.3, y: 402 },
  },
  {
    space: 'Kommons',
    parent: 'Jupiter',
    cx: 573.2,
    cy: 236,
    route: '/governance',
    Icon: IconSeedling,
    tetherFrom: { x: 573.2, y: 266 },
    tetherTo: { x: 573.2, y: 252 },
  },
  {
    space: 'Kalendar',
    parent: 'Neptune',
    cx: 245,
    cy: 608,
    route: '/kalendar',
    Icon: IconCalendar,
    tetherFrom: { x: 245, y: 638.5 },
    tetherTo: { x: 245, y: 624 },
  },
];

const SECTOR_LINES_DATA: [number, number, number, number][] = [
  [430, 400, 725, 400],
  [425.98, 385, 681.4, 237.5],
  [415, 374, 562.5, 118.6],
  [400, 370, 400, 75],
  [385, 374, 237.5, 118.6],
  [374.02, 385, 118.6, 237.5],
  [370, 400, 75, 400],
  [374.02, 415, 118.6, 562.5],
  [385, 426, 237.5, 681.4],
  [400, 430, 400, 725],
  [415, 426, 562.5, 681.4],
  [425.98, 415, 681.4, 562.5],
];

const STARS_DATA: [number, number, number, number][] = [
  [60, 70, 0.8, 0.6],
  [140, 42, 1, 0.85],
  [310, 30, 0.8, 0.7],
  [400, 18, 1.2, 0.9],
  [570, 30, 1, 0.8],
  [720, 52, 1.1, 0.85],
  [780, 340, 1, 0.8],
  [35, 270, 0.9, 0.75],
  [178, 172, 0.6, 0.5],
  [652, 184, 0.8, 0.7],
  [40, 900, 0.7, 0.6],
  [760, 950, 0.9, 0.75],
  [120, 1180, 0.7, 0.55],
  [680, 1220, 0.8, 0.7],
  [30, 1050, 0.5, 0.4],
];

interface Selection {
  name: string;
  glyph: string;
  nameLabel: string;
  domain: string;
  route: string | null;
}

function cubicEase(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function planetBezierPos(
  cx: number,
  cy: number,
  planetName: string,
  progress: number,
) {
  const r = Math.hypot(cx - 400, cy - 400);
  const order =
    PLANET_ORDER.indexOf(planetName) + 1;
  const listY = 400 + order * SPACING;
  const p0x = cx,
    p0y = cy;
  const p1x = 400,
    p1y = 400 + r;
  const p2x = 400,
    p2y = listY;
  const t = progress,
    mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
    y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y,
  };
}

export const Hub: React.FC = () => {
  const history = useHistory();
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const viewportRectRef = useRef<SVGRectElement>(null);
  const sunLabelRef = useRef<SVGTextElement>(null);
  const planetGroupsRef = useRef<Map<string, SVGGElement>>(new Map());
  const moonGroupsRef = useRef<Map<string, SVGGElement>>(new Map());
  const moonBloomsRef = useRef<Map<string, SVGGElement>>(new Map());
  const moonTethersRef = useRef<Map<string, SVGLineElement>>(new Map());
  const sectorLinesRef = useRef<SVGLineElement[]>([]);

  const zoomRef = useRef(1.0);
  const viewModeRef = useRef<'orbital' | 'list'>('orbital');
  const modeProgressRef = useRef(0);
  const openPlanetRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const modeAnimFrameRef = useRef<number | null>(null);

  const [selection, setSelection] = useState<Selection>({
    name: 'Sol',
    glyph: '☉︎',
    nameLabel: 'Sol · Self',
    domain: 'tap me to lay them out',
    route: null,
  });
  const [zoomInDisabled, setZoomInDisabled] = useState(false);
  const [zoomOutDisabled, setZoomOutDisabled] = useState(false);
  const [listMode, setListMode] = useState(false);

  // ── Core helpers ──────────────────────────────────────────────────────────
  const svgToScreen = useCallback((x: number, y: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(ctm);
  }, []);

  const screenToSvg = useCallback((x: number, y: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(ctm.inverse());
  }, []);

  const viewportCenter = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return { x: 0, y: 0 };
    const r = scroll.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  const updateZoomBtns = useCallback(() => {
    setZoomInDisabled(zoomRef.current >= MAX_ZOOM - 0.01);
    setZoomOutDisabled(zoomRef.current <= MIN_ZOOM + 0.01);
  }, []);

  const applyZoom = useCallback((newZoom: number) => {
    zoomRef.current = newZoom;
    const w = BASE_W * newZoom;
    const h = BASE_H * newZoom;
    const svg = svgRef.current;
    const pad = padRef.current;
    if (svg) {
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
    }
    if (pad) {
      pad.style.width = `${w}px`;
      pad.style.height = `${h}px`;
    }
  }, []);

  const updateMinimap = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll?.clientWidth) return;
    const r = scroll.getBoundingClientRect();
    const tl = screenToSvg(r.left, r.top);
    const br = screenToSvg(r.right, r.bottom);
    const vr = viewportRectRef.current;
    if (!tl || !br || !vr) return;
    vr.setAttribute('x', String(tl.x));
    vr.setAttribute('y', String(tl.y));
    vr.setAttribute('width', String(br.x - tl.x));
    vr.setAttribute('height', String(br.y - tl.y));
  }, [screenToSvg]);

  const applyCenter = useCallback(
    (svgX: number, svgY: number) => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      const pt = svgToScreen(svgX, svgY);
      const vc = viewportCenter();
      if (!pt) return;
      scroll.scrollLeft += pt.x - vc.x;
      scroll.scrollTop += pt.y - vc.y;
    },
    [svgToScreen, viewportCenter],
  );

  const smoothPanAndZoom = useCallback(
    (targetX: number, targetY: number, targetZoom: number, duration = 500) => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      const startZoom = zoomRef.current;
      const startLeft = scroll.scrollLeft;
      const startTop = scroll.scrollTop;

      applyZoom(targetZoom);
      const ptAtTarget = svgToScreen(targetX, targetY);
      const vc = viewportCenter();
      const endLeft = ptAtTarget
        ? scroll.scrollLeft + (ptAtTarget.x - vc.x)
        : startLeft;
      const endTop = ptAtTarget
        ? scroll.scrollTop + (ptAtTarget.y - vc.y)
        : startTop;

      applyZoom(startZoom);
      scroll.scrollLeft = startLeft;
      scroll.scrollTop = startTop;

      const startTime = performance.now();
      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = cubicEase(t);
        applyZoom(startZoom + (targetZoom - startZoom) * eased);
        scroll.scrollLeft = startLeft + (endLeft - startLeft) * eased;
        scroll.scrollTop = startTop + (endTop - startTop) * eased;
        updateMinimap();
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        } else {
          applyZoom(targetZoom);
          scroll.scrollLeft = endLeft;
          scroll.scrollTop = endTop;
          updateMinimap();
          animFrameRef.current = null;
          updateZoomBtns();
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    },
    [applyZoom, svgToScreen, viewportCenter, updateMinimap, updateZoomBtns],
  );

  const applyMode = useCallback((progress: number) => {
    modeProgressRef.current = progress;
    PLANETS.forEach((p) => {
      if (p.isSol) return;
      const g = planetGroupsRef.current.get(p.name);
      if (!g) return;
      const pos = planetBezierPos(p.cx, p.cy, p.name, progress);
      g.setAttribute('transform', `translate(${pos.x - p.cx} ${pos.y - p.cy})`);
    });
    sectorLinesRef.current.forEach((el) => {
      el.style.opacity = String(1 - progress);
    });
    if (sunLabelRef.current) {
      sunLabelRef.current.style.opacity = String(1 - progress);
    }
  }, []);

  const transitionMode = useCallback(
    (toMode: 'orbital' | 'list') => {
      if (modeAnimFrameRef.current) {
        cancelAnimationFrame(modeAnimFrameRef.current);
        modeAnimFrameRef.current = null;
      }
      const startProg = modeProgressRef.current;
      const endProg = toMode === 'list' ? 1 : 0;
      const duration = 900;
      const startTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = cubicEase(t);
        applyMode(startProg + (endProg - startProg) * eased);
        if (t < 1) {
          modeAnimFrameRef.current = requestAnimationFrame(step);
        } else {
          applyMode(endProg);
          modeAnimFrameRef.current = null;
        }
      };
      modeAnimFrameRef.current = requestAnimationFrame(step);
      viewModeRef.current = toMode;
      setListMode(toMode === 'list');
    },
    [applyMode],
  );

  // ── Moon helpers ──────────────────────────────────────────────────────────
  const collapseAllMoons = useCallback(() => {
    moonBloomsRef.current.forEach((el) =>
      { el.classList.add('hub-moon-bloom--collapsed'); },
    );
    moonTethersRef.current.forEach((el) =>
      { el.classList.add('hub-moon-tether--collapsed'); },
    );
  }, []);

  const bloomPlanetMoons = useCallback((planetName: string) => {
    const isListMode = viewModeRef.current === 'list';
    const order =
      PLANET_ORDER.indexOf(planetName) + 1;
    const listY = 400 + order * SPACING;

    let i = 0;
    MOONS.forEach((moon) => {
      if (moon.parent !== planetName) return;
      const g = moonGroupsRef.current.get(moon.space);
      if (!g) return;
      if (isListMode) {
        const targetX = 400 + MOON_OFFSET_X + i * 60;
        g.setAttribute(
          'transform',
          `translate(${targetX - moon.cx} ${listY - moon.cy})`,
        );
      } else {
        g.removeAttribute('transform');
      }
      const bloom = moonBloomsRef.current.get(moon.space);
      if (bloom) bloom.classList.remove('hub-moon-bloom--collapsed');
      if (!isListMode) {
        const tether = moonTethersRef.current.get(moon.space);
        if (tether) tether.classList.remove('hub-moon-tether--collapsed');
      }
      i++;
    });
  }, []);

  const setZoom = useCallback(
    (newZoom: number, fX?: number, fY?: number) => {
      if (viewModeRef.current === 'list') return;
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      if (Math.abs(newZoom - zoomRef.current) < 0.001) return;
      const scroll = scrollRef.current;
      if (!scroll) return;
      let focusX = fX,
        focusY = fY ?? 400;
      if (focusX === undefined) {
        const vc = viewportCenter();
        const p = screenToSvg(vc.x, vc.y);
        focusX = p?.x ?? 400;
        focusY = p?.y ?? 400;
      }
      const beforeScreen = svgToScreen(focusX, focusY);
      applyZoom(newZoom);
      const afterScreen = svgToScreen(focusX, focusY);
      if (beforeScreen && afterScreen) {
        scroll.scrollLeft += afterScreen.x - beforeScreen.x;
        scroll.scrollTop += afterScreen.y - beforeScreen.y;
      }
      updateMinimap();
      updateZoomBtns();
    },
    [
      viewportCenter,
      screenToSvg,
      svgToScreen,
      applyZoom,
      updateMinimap,
      updateZoomBtns,
    ],
  );

  // ── Planet tap ────────────────────────────────────────────────────────────
  const handlePlanetTap = useCallback(
    (planetName: string) => {
      const planet = PLANETS.find((p) => p.name === planetName);
      if (!planet) return;

      if (planetName === 'Sol') {
        const newMode = viewModeRef.current === 'orbital' ? 'list' : 'orbital';
        collapseAllMoons();
        openPlanetRef.current = null;
        transitionMode(newMode);
        if (newMode === 'list') {
          setSelection({
            name: 'Sol',
            glyph: '☉︎',
            nameLabel: 'Sol · Self',
            domain: 'tap again to scatter',
            route: null,
          });
          smoothPanAndZoom(400, 720, 1.0, 900);
        } else {
          setSelection({
            name: 'Sol',
            glyph: '☉︎',
            nameLabel: 'Sol · Self',
            domain: 'the inner workings of self',
            route: null,
          });
          smoothPanAndZoom(400, 400, 1.0, 900);
        }
        return;
      }

      const parts = planet.meaning.split(' · ');
      setSelection({
        name: planetName,
        glyph: planet.glyph,
        nameLabel: `${planetName} · ${parts[0]}`,
        domain: parts.slice(1).join(' · ') || planet.meaning,
        route: null,
      });

      const hasMoons = MOONS.some((m) => m.parent === planetName);

      if (viewModeRef.current === 'list') {
        const listY =
          400 +
          (PLANET_ORDER.indexOf(planetName) +
            1) *
            SPACING;
        if (hasMoons) {
          if (openPlanetRef.current === planetName) {
            collapseAllMoons();
            openPlanetRef.current = null;
            smoothPanAndZoom(400, listY, zoomRef.current, 400);
          } else {
            collapseAllMoons();
            bloomPlanetMoons(planetName);
            openPlanetRef.current = planetName;
            smoothPanAndZoom(SHIFT_X, listY, zoomRef.current, 400);
          }
        } else {
          collapseAllMoons();
          openPlanetRef.current = null;
          smoothPanAndZoom(400, listY, zoomRef.current, 400);
        }
        return;
      }

      const pos = planetBezierPos(
        planet.cx,
        planet.cy,
        planetName,
        modeProgressRef.current,
      );
      smoothPanAndZoom(pos.x, pos.y, WHEEL_ZOOM, 500);
      if (openPlanetRef.current === planetName) {
        collapseAllMoons();
        openPlanetRef.current = null;
      } else {
        collapseAllMoons();
        if (hasMoons) {
          bloomPlanetMoons(planetName);
          openPlanetRef.current = planetName;
        } else {
          openPlanetRef.current = null;
        }
      }
    },
    [collapseAllMoons, transitionMode, smoothPanAndZoom, bloomPlanetMoons],
  );

  const handleMoonTap = useCallback((spaceName: string, parent: string) => {
    const moon = MOONS.find((m) => m.space === spaceName);
    setSelection({
      name: spaceName,
      glyph: '',
      nameLabel: `${spaceName} · ${parent}`,
      domain: `a moon of ${parent}`,
      route: moon?.route ?? null,
    });
  }, []);

  const handleEnter = useCallback(() => {
    if (selection.route) {
      history.push(selection.route);
    }
  }, [selection.route, history]);

  // Stable data-attribute-driven handlers for JSX maps
  const handlePlanetGroupClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      const name = e.currentTarget.getAttribute('data-planet');
      if (name) handlePlanetTap(name);
    },
    [handlePlanetTap],
  );

  const handleMoonGroupClick = useCallback(
    (e: React.MouseEvent<SVGGElement>) => {
      const space = e.currentTarget.getAttribute('data-space');
      const parent = e.currentTarget.getAttribute('data-parent');
      if (space && parent) handleMoonTap(space, parent);
    },
    [handleMoonTap],
  );

  const handleZoomIn = useCallback(() => {
    setZoom(zoomRef.current * 1.3);
  }, [setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(zoomRef.current / 1.3);
  }, [setZoom]);

  // ── Init & scroll events ──────────────────────────────────────────────────
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    const tryInit = () => {
      if (scroll.clientWidth === 0) {
        requestAnimationFrame(tryInit);
        return;
      }
      applyZoom(1.0);
      applyCenter(400, 400);
      updateMinimap();
      updateZoomBtns();
    };
    tryInit();

    scroll.addEventListener('scroll', updateMinimap);
    return () => { scroll.removeEventListener('scroll', updateMinimap); };
  }, [applyZoom, applyCenter, updateMinimap, updateZoomBtns]);

  // ── Mouse drag ────────────────────────────────────────────────────────────
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    let isDown = false,
      sX = 0,
      sY = 0,
      sL = 0,
      sT = 0;
    let moved = false;

    const onDown = (e: MouseEvent) => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      isDown = true;
      sX = e.pageX;
      sY = e.pageY;
      sL = scroll.scrollLeft;
      sT = scroll.scrollTop;
      moved = false;
      if (viewModeRef.current !== 'list')
        scroll.classList.add('hub-scroll--grabbing');
    };
    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      const dx = e.pageX - sX,
        dy = e.pageY - sY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (moved) {
        if (viewModeRef.current !== 'list') scroll.scrollLeft = sL - dx;
        scroll.scrollTop = sT - dy;
      }
    };
    const onUp = () => {
      isDown = false;
      scroll.classList.remove('hub-scroll--grabbing');
    };

    scroll.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    return () => {
      scroll.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // ── Touch / pinch ─────────────────────────────────────────────────────────
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;

    let pinching = false,
      pSD = 0,
      pSZ = 1,
      pFX = 0,
      pFY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && viewModeRef.current !== 'list') {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        pinching = true;
        const t0 = e.touches.item(0);
        const t1 = e.touches.item(1);
        if (!t0 || !t1) return;
        const dx = t0.pageX - t1.pageX;
        const dy = t0.pageY - t1.pageY;
        pSD = Math.sqrt(dx * dx + dy * dy);
        pSZ = zoomRef.current;
        const mX = (t0.clientX + t1.clientX) / 2;
        const mY = (t0.clientY + t1.clientY) / 2;
        const p = screenToSvg(mX, mY);
        if (p) {
          pFX = p.x;
          pFY = p.y;
        }
        e.preventDefault();
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (pinching && e.touches.length === 2) {
        e.preventDefault();
        const t0 = e.touches.item(0);
        const t1 = e.touches.item(1);
        if (!t0 || !t1) return;
        const dx = t0.pageX - t1.pageX;
        const dy = t0.pageY - t1.pageY;
        setZoom(pSZ * (Math.sqrt(dx * dx + dy * dy) / pSD), pFX, pFY);
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinching = false;
    };

    scroll.addEventListener('touchstart', onTouchStart, { passive: false });
    scroll.addEventListener('touchmove', onTouchMove, { passive: false });
    scroll.addEventListener('touchend', onTouchEnd);

    return () => {
      scroll.removeEventListener('touchstart', onTouchStart);
      scroll.removeEventListener('touchmove', onTouchMove);
      scroll.removeEventListener('touchend', onTouchEnd);
    };
  }, [screenToSvg, setZoom]);

  // ── Minimap click ─────────────────────────────────────────────────────────
  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (viewModeRef.current === 'list') return;
      const rect = minimapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = ((e.clientX - rect.left) / rect.width) * BASE_W;
      const sy = ((e.clientY - rect.top) / rect.height) * BASE_W;
      applyCenter(sx, sy);
      updateMinimap();
    },
    [applyCenter, updateMinimap],
  );

  const handleMinimapKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleMinimapClick(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
    },
    [handleMinimapClick],
  );

  // ── Ref collectors ────────────────────────────────────────────────────────
  const setPlanetRef = useCallback(
    (name: string) => (el: SVGGElement | null) => {
      if (el) planetGroupsRef.current.set(name, el);
    },
    [],
  );

  const setMoonGroupRef = useCallback(
    (space: string) => (el: SVGGElement | null) => {
      if (el) moonGroupsRef.current.set(space, el);
    },
    [],
  );

  const setMoonBloomRef = useCallback(
    (space: string) => (el: SVGGElement | null) => {
      if (el) moonBloomsRef.current.set(space, el);
    },
    [],
  );

  const setMoonTetherRef = useCallback(
    (space: string) => (el: SVGLineElement | null) => {
      if (el) moonTethersRef.current.set(space, el);
    },
    [],
  );

  const setSectorLineRef = useCallback(
    (i: number) => (el: SVGLineElement | null) => {
      if (el) sectorLinesRef.current[i] = el;
    },
    [],
  );

  const glyphStyle: React.CSSProperties = {
    fontFamily: "'Liberation Serif', 'Times New Roman', Georgia, serif",
    textAnchor: 'middle',
    dominantBaseline: 'central',
    pointerEvents: 'none',
    fontVariantEmoji: 'text' as React.CSSProperties['fontVariantEmoji'],
  } as React.CSSProperties;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: PAGE_BG,
        color: TEXT_PRIMARY,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '14px 20px 6px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: "'Liberation Serif', 'Times New Roman', Georgia, serif",
            fontSize: 13,
            letterSpacing: '2.5px',
            color: TEXT_PRIMARY,
          }}
        >
          Ӂ Я Ѻ Ɲ ₭
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#5C5878',
            letterSpacing: '1.5px',
            textTransform: 'lowercase',
          }}
        >
          the hub
        </div>
      </div>

      {/* Map area */}
      <div
        ref={areaRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          margin: '0 2px',
        }}
        className={listMode ? 'hub-area hub-area--list' : 'hub-area'}
      >
        <div
          ref={scrollRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'auto',
            scrollbarWidth: 'none',
            cursor: 'grab',
            touchAction: listMode ? 'pan-y' : 'pan-x pan-y',
          }}
          className={listMode ? 'hub-scroll hub-scroll--list' : 'hub-scroll'}
        >
          <div
            ref={padRef}
            style={{ padding: 200, display: 'block', boxSizing: 'content-box' }}
          >
            <svg
              ref={svgRef}
              viewBox='0 0 800 1300'
              width={800}
              height={1300}
              style={{ display: 'block' }}
            >
              {/* Stars */}
              <g>
                {STARS_DATA.map(([cx, cy, r, opacity], i) => (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={STARS_COLOR}
                    opacity={opacity}
                  />
                ))}
              </g>

              {/* Sector lines */}
              <g>
                {SECTOR_LINES_DATA.map(([x1, y1, x2, y2], i) => (
                  <line
                    key={i}
                    ref={setSectorLineRef(i)}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={SECTOR_LINES}
                    strokeWidth={0.6}
                  />
                ))}
              </g>

              {/* Orbital rings */}
              <g>
                {ORBIT_RADII.map((r) => (
                  <circle
                    key={r}
                    cx={400}
                    cy={400}
                    r={r}
                    fill='none'
                    stroke={ORBITS}
                    strokeWidth={0.8}
                  />
                ))}
              </g>

              {/* Sol */}
              <g
                ref={setPlanetRef('Sol')}
                data-planet='Sol'
                style={{ cursor: 'pointer' }}
                onClick={handlePlanetGroupClick}
              >
                <circle
                  cx={400}
                  cy={400}
                  r={48}
                  fill={SOL_BODY}
                  opacity={0.09}
                />
                <circle
                  cx={400}
                  cy={400}
                  r={38}
                  fill={SOL_BODY}
                  opacity={0.18}
                />
                <circle cx={400} cy={400} r={30} fill={SOL_BODY} />
                <text
                  x={400}
                  y={400}
                  fill={SOL_GLYPH}
                  style={{ ...glyphStyle, fontSize: 36 }}
                >
                  ☉︎
                </text>
                <text
                  ref={sunLabelRef}
                  x={400}
                  y={478}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fill: SOL_LABEL,
                    textAnchor: 'middle',
                    pointerEvents: 'none',
                  }}
                >
                  Self
                </text>
              </g>

              {/* Moon tethers */}
              {MOONS.map((moon) => (
                <line
                  key={`tether-${moon.space}`}
                  ref={setMoonTetherRef(moon.space)}
                  x1={moon.tetherFrom.x}
                  y1={moon.tetherFrom.y}
                  x2={moon.tetherTo.x}
                  y2={moon.tetherTo.y}
                  fill='none'
                  stroke='#3D2A8C'
                  strokeWidth={0.6}
                  strokeDasharray='2 3'
                  opacity={0.5}
                  className='hub-moon-tether hub-moon-tether--collapsed'
                />
              ))}

              {/* Planets + moons */}
              {PLANETS.filter((p) => !p.isSol).map((planet) => (
                <g key={planet.name}>
                  <g
                    ref={setPlanetRef(planet.name)}
                    data-planet={planet.name}
                    style={{ cursor: 'pointer' }}
                    onClick={handlePlanetGroupClick}
                  >
                    <circle
                      cx={planet.cx}
                      cy={planet.cy}
                      r={planet.haloR}
                      fill={BRAND_PURPLE}
                      opacity={0.14}
                      className='hub-planet-halo'
                    />
                    {planet.hasRings && (
                      <ellipse
                        cx={planet.cx}
                        cy={planet.cy}
                        rx={28}
                        ry={7}
                        fill='none'
                        stroke={SATURN_RINGS}
                        strokeWidth={1.3}
                        transform={`rotate(-22 ${planet.cx} ${planet.cy})`}
                      />
                    )}
                    <circle
                      cx={planet.cx}
                      cy={planet.cy}
                      r={planet.bodyR}
                      fill={BRAND_PURPLE}
                    />
                    <text
                      x={planet.cx}
                      y={planet.cy}
                      fill={GLYPH_FILL}
                      style={{ ...glyphStyle, fontSize: planet.bodyR * 1.6 }}
                    >
                      {planet.glyph}
                    </text>
                    <text
                      x={planet.cx}
                      y={planet.cy + planet.haloR + (planet.hasRings ? 20 : 12)}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 14,
                        fill: PLANET_LABEL,
                        textAnchor: 'middle',
                        pointerEvents: 'none',
                      }}
                    >
                      {planet.name}
                    </text>
                  </g>

                  {/* Moons for this planet */}
                  {MOONS.filter((m) => m.parent === planet.name).map((moon) => (
                    <g
                      key={moon.space}
                      ref={setMoonGroupRef(moon.space)}
                      data-space={moon.space}
                      data-parent={moon.parent}
                      style={{ cursor: 'pointer' }}
                      onClick={handleMoonGroupClick}
                    >
                      <g
                        ref={setMoonBloomRef(moon.space)}
                        className='hub-moon-bloom hub-moon-bloom--collapsed'
                        style={{
                          transformBox: 'fill-box',
                          transformOrigin: 'center',
                          transition:
                            'transform 0.4s cubic-bezier(0.34, 1.5, 0.64, 1), opacity 0.3s',
                        }}
                      >
                        <circle
                          cx={moon.cx}
                          cy={moon.cy}
                          r={20}
                          fill={BRAND_PURPLE}
                          opacity={0.18}
                          className='hub-moon-halo'
                        />
                        <circle
                          cx={moon.cx}
                          cy={moon.cy}
                          r={12}
                          fill={BRAND_PURPLE}
                        />
                        <foreignObject
                          x={moon.cx - 12}
                          y={moon.cy - 12}
                          width={24}
                          height={24}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              height: '100%',
                              color: GLYPH_FILL,
                            }}
                          >
                            <moon.Icon size={14} stroke={2} />
                          </div>
                        </foreignObject>
                        <text
                          x={moon.cx}
                          y={moon.cy - 22}
                          style={{
                            fontFamily: 'inherit',
                            fontSize: 11,
                            fill: PLANET_LABEL,
                            textAnchor: 'middle',
                            pointerEvents: 'none',
                          }}
                        >
                          {moon.space.toLowerCase()}
                        </text>
                      </g>
                    </g>
                  ))}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Minimap */}
        <div
          ref={minimapRef}
          role='button'
          tabIndex={0}
          aria-label='Minimap — click to pan'
          onClick={handleMinimapClick}
          onKeyDown={handleMinimapKeyDown}
          className={
            listMode ? 'hub-minimap hub-minimap--hidden' : 'hub-minimap'
          }
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 64,
            height: 64,
            background: 'rgba(19,22,42,0.92)',
            border: '0.5px solid #3D3858',
            borderRadius: '50%',
            overflow: 'hidden',
            zIndex: 3,
            cursor: 'pointer',
            transition: 'opacity 0.4s',
            opacity: listMode ? 0 : 1,
            pointerEvents: listMode ? 'none' : 'auto',
          }}
        >
          <svg
            viewBox='0 0 800 800'
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            {[60, 122, 200, 280, 340].map((r) => (
              <circle
                key={r}
                cx={400}
                cy={400}
                r={r}
                fill='none'
                stroke='#2A2552'
                strokeWidth={7}
              />
            ))}
            <circle cx={400} cy={400} r={40} fill={SOL_BODY} />
            <rect
              ref={viewportRectRef}
              x={0}
              y={0}
              width={0}
              height={0}
              fill={ACCENT_TEXT}
              opacity={0.22}
              stroke={ACCENT_TEXT}
              strokeWidth={6}
            />
          </svg>
        </div>

        {/* Zoom controls */}
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 4,
            transition: 'opacity 0.4s',
            opacity: listMode ? 0 : 1,
            pointerEvents: listMode ? 'none' : 'auto',
          }}
        >
          <button
            onClick={handleZoomIn}
            disabled={zoomInDisabled}
            aria-label='Zoom in'
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(19,22,42,0.95)',
              border: '1px solid #3D3858',
              color: GLYPH_FILL,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2.5}
              strokeLinecap='round'
              width={16}
              height={16}
            >
              <line x1={12} y1={5} x2={12} y2={19} />
              <line x1={5} y1={12} x2={19} y2={12} />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomOutDisabled}
            aria-label='Zoom out'
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(19,22,42,0.95)',
              border: '1px solid #3D3858',
              color: GLYPH_FILL,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth={2.5}
              strokeLinecap='round'
              width={16}
              height={16}
            >
              <line x1={5} y1={12} x2={19} y2={12} />
            </svg>
          </button>
        </div>
      </div>

      {/* Detail card */}
      <div
        style={{
          margin: '8px 14px 28px',
          padding: '10px 14px',
          background: CARD_BG,
          borderRadius: 14,
          border: `0.5px solid ${CARD_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: ACCENT_TEXT,
            fontFamily: "'Times New Roman', 'Liberation Serif', Georgia, serif",
            fontSize: 24,
            lineHeight: 1,
          }}
        >
          {selection.glyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              margin: '0 0 2px',
            }}
          >
            {selection.nameLabel}
          </p>
          <p style={{ fontSize: 11, color: TEXT_SECONDARY, margin: 0 }}>
            {selection.domain}
          </p>
        </div>
        {selection.route && (
          <button
            onClick={handleEnter}
            style={{
              background: 'transparent',
              border: `0.5px solid ${BRAND_PURPLE}`,
              color: ACCENT_TEXT,
              padding: '6px 13px',
              borderRadius: 999,
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
              flexShrink: 0,
            }}
          >
            Enter ↗
          </button>
        )}
      </div>

      <style>{`
        .hub-moon-bloom--collapsed {
          opacity: 0;
          transform: scale(0.1);
          pointer-events: none;
        }
        .hub-moon-tether--collapsed {
          opacity: 0;
        }
        .hub-scroll--grabbing {
          cursor: grabbing !important;
        }
        .hub-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};
