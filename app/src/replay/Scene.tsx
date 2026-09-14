import { useEffect, useRef } from "react";
import {
  AmbientLight,
  ACESFilmicToneMapping,
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  DirectionalLight,
  Group,
  Fog,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene as ThreeScene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { environment } from "../scene/environments";
import { themes } from "../scene/themes";
import type { ThemeId } from "../scene/themes";
import { createAvatar } from "../components/avatar";
import type { AvatarRig } from "../components/avatar";
import { court, dispose } from "../components/court";
import type { Frame } from "../api";
interface AnimatedScene {
  readonly group: Group;
  readonly rigs: Map<number, AvatarRig>;
  readonly ball: Mesh<SphereGeometry, MeshStandardMaterial>;
  readonly trail: Line<BufferGeometry, LineBasicMaterial>;
  readonly positions: Float32BufferAttribute;
}
export function Scene({
  theme,
  frame,
  trail,
  reset,
}: {
  readonly theme: ThemeId;
  readonly frame: Frame | undefined;
  readonly trail: readonly (readonly [number, number, number])[];
  readonly reset: number;
}) {
  const target = useRef<HTMLDivElement>(null);
  const actors = useRef<AnimatedScene | null>(null);
  useEffect(() => {
    const element = target.current;
    if (element === null) return () => {};
    const scene = new ThreeScene();
    scene.name = `replay-camera-${reset}`;
    scene.background = new Color(themes[theme].sky);
    scene.fog = new Fog(themes[theme].sky, 12, 35);
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    element.append(renderer.domElement);
    const camera = new PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(5.2, 4.1, 5.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.65, 0);
    controls.minDistance = 2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2.03;
    controls.enableDamping = true;
    controls.update();
    scene.add(new AmbientLight(themes[theme].light, theme === "neon" ? 1.2 : 1.5));
    const light = new DirectionalLight(themes[theme].light, 2.4);
    light.position.set(4, 6, 3);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -7;
    light.shadow.camera.right = 7;
    light.shadow.camera.top = 7;
    light.shadow.camera.bottom = -7;
    light.shadow.bias = -0.001;
    scene.add(light);
    const table = court(themes[theme]);
    const surroundings = environment(theme);
    const backWall = surroundings.children.filter(
      (object) => object.position.z < -3 && object.position.y > 0.1,
    );
    scene.add(surroundings);
    scene.add(table);
    const moving = new Group();
    scene.add(moving);
    const ball = new Mesh(
      new SphereGeometry(0.035, 16, 16),
      new MeshStandardMaterial({ color: "#ffd180", emissive: "#e99742", emissiveIntensity: 0.5 }),
    );
    moving.add(ball);
    const positions = new Float32BufferAttribute(new Float32Array(450), 3);
    const pathGeometry = new BufferGeometry();
    pathGeometry.setAttribute("position", positions);
    pathGeometry.setDrawRange(0, 0);
    const path = new Line(
      pathGeometry,
      new LineBasicMaterial({ color: themes[theme].accent, transparent: true, opacity: 0.8 }),
    );
    path.frustumCulled = false;
    moving.add(path);
    actors.current = { group: moving, rigs: new Map(), ball, trail: path, positions };
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width > 0 && height > 0) {
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    observer.observe(element);
    let sampleStart = performance.now();
    let renderedFrames = 0;
    renderer.setAnimationLoop(() => {
      controls.update();
      if (theme === "club" || theme === "mishka" || theme === "neon") {
        for (const object of backWall) object.visible = camera.position.z > -4;
      }
      renderer.render(scene, camera);
      renderedFrames += 1;
      const now = performance.now();
      if (now - sampleStart >= 1000) {
        performance.clearMeasures("rallylab-render");
        performance.measure("rallylab-render", {
          start: sampleStart,
          end: now,
          detail: {
            fps: (renderedFrames * 1000) / (now - sampleStart),
            drawCalls: renderer.info.render.calls,
          },
        });
        renderedFrames = 0;
        sampleStart = now;
      }
    });
    return () => {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      dispose(table);
      dispose(surroundings);
      dispose(moving);
      renderer.dispose();
      renderer.domElement.remove();
      actors.current = null;
    };
  }, [reset, theme]);
  useEffect(() => {
    const animated = actors.current;
    if (animated === null) return;
    animated.group.name = `replay-actors-${reset}`;
    for (const rig of animated.rigs.values()) rig.group.visible = false;
    for (const pose of frame?.players ?? []) {
      let rig = animated.rigs.get(pose.player);
      if (rig === undefined) {
        rig = createAvatar(pose, theme);
        animated.rigs.set(pose.player, rig);
        animated.group.add(rig.group);
      } else rig.update(pose);
    }
    const ball = frame?.ball;
    animated.ball.visible = ball !== undefined && ball !== null;
    if (ball !== undefined && ball !== null) animated.ball.position.set(ball.x, ball.y, ball.z);
    const points = trail.slice(-150);
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (point !== undefined) animated.positions.setXYZ(index, ...point);
    }
    animated.positions.needsUpdate = true;
    animated.trail.geometry.setDrawRange(0, points.length);
  }, [frame, trail, reset, theme]);
  return <div className="three-canvas" ref={target} aria-label="Rotatable 3D replay" />;
}
