<<<<<<< HEAD
import { useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import { useStore } from '../store';
import type { UrdfLimits } from '../types';
=======
import React, { useEffect, useRef, useState } from 'react';
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import URDFLoader from 'urdf-loader';
import { commandBus } from '../safety/commandBus';
import { PANEL_BOUNDS, WORKSPACE } from '../safety/safetyGate';
import { getStylusPose } from '../kinematics/ikSolver';
import { AlertTriangle, Info } from 'lucide-react';

<<<<<<< HEAD
const RobotArm = () => {
  const joints = useStore((state) => state.joints);
  const setUrdfLimits = useStore((state) => state.setUrdfLimits);
  const [robot, setRobot] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const loader = new URDFLoader();
      loader.load('/6_dof_arm.urdf', (urdf) => {
        try {
          urdf.traverse((child: any) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.6 });
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          // Ensure the root base is correctly oriented
          urdf.rotation.x = -Math.PI / 2;
          
          // Parse limits for Layer 2 Safety Gate
          const limits: UrdfLimits = {};
          for (const jointName in urdf.joints) {
             const joint = urdf.joints[jointName];
             if (joint.limit) {
                limits[jointName] = { 
                  min: joint.limit.lower, 
                  max: joint.limit.upper, 
                  effort: joint.limit.effort, 
                  velocity: joint.limit.velocity 
                };
             }
          }
          setUrdfLimits(limits);
          setRobot(urdf);
        } catch (err: any) {
           setErrorMsg('URDF parsing callback error: ' + err.message);
=======
interface RobotSimulatorProps {
  showWorkspace: boolean;
  showTrail: boolean;
  clearTrailTrigger: number;
}

export const RobotSimulator: React.FC<RobotSimulatorProps> = ({
  showWorkspace,
  showTrail,
  clearTrailTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [safetyAlert, setSafetyAlert] = useState<{ active: boolean; msg: string }>({ active: false, msg: '' });

  // Refs for Three.js objects
  const robotRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const targetMarkerRef = useRef<THREE.Mesh | null>(null);
  const trailPointsRef = useRef<THREE.Vector3[]>([]);
  const trailLineRef = useRef<THREE.Line | null>(null);
  const workspaceSphereRef = useRef<THREE.Mesh | null>(null);
  const keysMeshesRef = useRef<{ [key: string]: THREE.Mesh }>({});
  
  // Track active key touches
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Handle trail clearing
  useEffect(() => {
    trailPointsRef.current = [];
    if (trailLineRef.current) {
      const geometry = trailLineRef.current.geometry;
      geometry.setFromPoints([]);
    }
  }, [clearTrailTrigger]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131518); // Dark graphite theme
    sceneRef.current = scene;

    // Grid helper
    const gridHelper = new THREE.GridHelper(3, 30, 0x95600a, 0x222427);
    gridHelper.position.y = 0.001; // Avoid z-fighting
    scene.add(gridHelper);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(
      55,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.01,
      10
    );
    camera.position.set(1.2, 1.0, 1.2);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above ground
    controls.minDistance = 0.3;
    controls.maxDistance = 4.0;
    controls.target.set(0.3, 0, 0.4);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(2, 4, 3);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffb545, 0.3); // Warm orange accent light
    dirLight2.position.set(-2, 2, -1);
    scene.add(dirLight2);

    // 6. Draw Workspace Sphere
    const wsGeo = new THREE.SphereGeometry(WORKSPACE.maxRadius, 32, 32);
    const wsMat = new THREE.MeshBasicMaterial({
      color: 0x95600a,
      wireframe: true,
      transparent: true,
      opacity: 0.03,
      depthWrite: false,
    });
    const wsSphere = new THREE.Mesh(wsGeo, wsMat);
    wsSphere.position.set(0, 0, 0.06); // base J1 center
    scene.add(wsSphere);
    workspaceSphereRef.current = wsSphere;

    // 7. Render Key Panel
    // Panel housing box
    const panelHousingGeo = new THREE.BoxGeometry(
      PANEL_BOUNDS.maxX - PANEL_BOUNDS.minX,
      PANEL_BOUNDS.maxY - PANEL_BOUNDS.minY,
      PANEL_BOUNDS.maxZ - PANEL_BOUNDS.minZ
    );
    const panelHousingMat = new THREE.MeshStandardMaterial({
      color: 0x2d3139,
      roughness: 0.7,
      metalness: 0.2,
    });
    const panelHousing = new THREE.Mesh(panelHousingGeo, panelHousingMat);
    panelHousing.position.set(
      (PANEL_BOUNDS.minX + PANEL_BOUNDS.maxX) / 2,
      (PANEL_BOUNDS.minY + PANEL_BOUNDS.maxY) / 2,
      (PANEL_BOUNDS.minZ + PANEL_BOUNDS.maxZ) / 2
    );
    scene.add(panelHousing);

    // Draw the 6 individual keys on the panel
    const keysConfig = {
      '1': { x: 0.5, y: 0.05, z: 0.05 },
      '2': { x: 0.55, y: 0.05, z: 0.05 },
      '3': { x: 0.6, y: 0.05, z: 0.05 },
      '4': { x: 0.5, y: -0.05, z: 0.05 },
      '5': { x: 0.55, y: -0.05, z: 0.05 },
      '6': { x: 0.6, y: -0.05, z: 0.05 },
    };

    const keyGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.012, 16);
    keyGeo.rotateX(Math.PI / 2); // Make cylinder vertical

    const keysMeshes: { [key: string]: THREE.Mesh } = {};

    Object.entries(keysConfig).forEach(([keyName, coords]) => {
      // Small bezel
      const bezelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16);
      bezelGeo.rotateX(Math.PI / 2);
      const bezelMat = new THREE.MeshStandardMaterial({ color: 0x4a4f5d, roughness: 0.4 });
      const bezel = new THREE.Mesh(bezelGeo, bezelMat);
      bezel.position.set(coords.x, coords.y, coords.z + 0.002);
      scene.add(bezel);

      // Key itself
      const keyMat = new THREE.MeshStandardMaterial({
        color: 0x4682b4, // Slate blue default
        emissive: 0x000000,
        roughness: 0.2,
      });
      const keyMesh = new THREE.Mesh(keyGeo, keyMat);
      keyMesh.position.set(coords.x, coords.y, coords.z + 0.006);
      scene.add(keyMesh);
      keysMeshes[keyName] = keyMesh;

      // Add a small 3D text label above the key (drawn with a CanvasTexture to avoid FontLoader sizes)
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#131518';
        ctx.fillRect(0, 0, 64, 64);
        ctx.font = 'bold 36px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(keyName, 32, 32);
      }
      const labelTexture = new THREE.CanvasTexture(canvas);
      const labelGeo = new THREE.PlaneGeometry(0.018, 0.018);
      const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, side: THREE.DoubleSide });
      const labelMesh = new THREE.Mesh(labelGeo, labelMat);
      labelMesh.position.set(coords.x, coords.y, coords.z + 0.0125);
      scene.add(labelMesh);
    });
    keysMeshesRef.current = keysMeshes;

    // 8. Glowing Target coordinate Marker
    const targetMarkerGeo = new THREE.SphereGeometry(0.012, 16, 16);
    const targetMarkerMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.8,
    });
    const targetMarker = new THREE.Mesh(targetMarkerGeo, targetMarkerMat);
    scene.add(targetMarker);
    targetMarkerRef.current = targetMarker;

    // 9. Trail Line Setup
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      linewidth: 2,
    });
    const trailGeo = new THREE.BufferGeometry();
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    trailLineRef.current = trailLine;

    // 10. Load URDF Robot
    const manager = new THREE.LoadingManager();
    const loader = new URDFLoader(manager);
    
    // We can parse the local URDF model
    loader.load(
      '/6_dof_arm.urdf',
      (robot: any) => {
        robot.rotation.x = -Math.PI / 2; // Orient URDF coordinates (Z up) to Three.js (Y up)
        // Wait! In the URDF, Z is vertical, but in standard Three.js, Y is vertical.
        // urdf-loader handles the conversion internally, but sometimes orienting the base is needed.
        // Let's keep it standard. Let's make sure the base rests on the ground.
        robot.position.set(0, 0, 0);
        scene.add(robot);
        robotRef.current = robot;
        setLoading(false);
      },
      undefined,
      (err: any) => {
        console.error('Failed to load URDF:', err);
        setLoadError('Failed to load URDF file. Please verify it is in public directory.');
        setLoading(false);
      }
    );

    // 11. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Sync Robot joint angles
      const currentJoints = commandBus.getJoints();
      const robot = robotRef.current;
      if (robot && robot.joints) {
        Object.entries(currentJoints).forEach(([jointName, value]) => {
          if (robot.joints[jointName]) {
            robot.joints[jointName].setJointValue(value);
          }
        });
      }

      // Sync target marker coordinate
      const targetJoints = commandBus.getTargetJoints();
      const targetPose = getStylusPose(targetJoints);
      if (targetMarker) {
        targetMarker.position.set(targetPose.x, targetPose.y, targetPose.z);
      }

      // Sync Stylus Trail
      const currentPose = getStylusPose(currentJoints);
      const tipPos = new THREE.Vector3(currentPose.x, currentPose.y, currentPose.z);
      
      if (showTrail) {
        // Only append point if moved
        const points = trailPointsRef.current;
        if (points.length === 0 || points[points.length - 1].distanceTo(tipPos) > 0.005) {
          points.push(tipPos.clone());
          // Cap trail length
          if (points.length > 500) {
            points.shift();
          }
          if (trailLine) {
            trailLine.geometry.setFromPoints(points);
          }
        }
      } else {
        if (trailLine) {
          trailLine.geometry.setFromPoints([]);
        }
      }

      // Check key touches (within 5mm)
      let touchedKey: string | null = null;
      Object.entries(keysConfig).forEach(([keyName, coords]) => {
        const keyPos = new THREE.Vector3(coords.x, coords.y, coords.z + 0.01);
        const dist = tipPos.distanceTo(keyPos);
        const mesh = keysMeshes[keyName];
        if (mesh) {
          if (dist < 0.008) { // 8mm contact radius
            touchedKey = keyName;
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(0x228b22); // Green for active touch
            (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x0a4a0a);
          } else {
            (mesh.material as THREE.MeshStandardMaterial).color.setHex(0x4682b4); // Default steel blue
            (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
        }
      }, undefined, (err: any) => {
         setErrorMsg('URDF load error: ' + (err.message || 'unknown error'));
      });
<<<<<<< HEAD
    } catch (e: any) {
      setErrorMsg('URDFLoader init error: ' + e.message);
    }
  }, [setUrdfLimits]);

  useFrame(() => {
    if (robot) {
      if (robot.joints['joint_1']) robot.joints['joint_1'].setJointValue(joints.joint_1);
      if (robot.joints['joint_2']) robot.joints['joint_2'].setJointValue(joints.joint_2);
      if (robot.joints['joint_3']) robot.joints['joint_3'].setJointValue(joints.joint_3);
      if (robot.joints['joint_4']) robot.joints['joint_4'].setJointValue(joints.joint_4);
      if (robot.joints['joint_5']) robot.joints['joint_5'].setJointValue(joints.joint_5);
      if (robot.joints['joint_6']) robot.joints['joint_6'].setJointValue(joints.joint_6);
      if (robot.joints['stylus_pitch']) robot.joints['stylus_pitch'].setJointValue(joints.stylus_pitch);
    }
  });

  if (errorMsg) {
     return (
       <Html center>
         <div style={{ color: 'red', background: 'rgba(0,0,0,0.8)', padding: '10px' }}>
           {errorMsg}
         </div>
       </Html>
     );
  }

  return robot ? <primitive object={robot} /> : null;
};
=======
      setActiveKey(touchedKey);

      // Check for safety violations to display visual alert
      const state = commandBus.getState();
      if (state === 'FAULT' || state === 'ESTOPPED') {
        const lastLog = commandBus.getLogs().reverse().find(l => l.type === 'error');
        setSafetyAlert({
          active: true,
          msg: lastLog ? lastLog.message : 'Safety halt triggered!',
        });
        // Flash grid
        gridHelper.material.color.setHex(0xff0000);
      } else {
        setSafetyAlert({ active: false, msg: '' });
        gridHelper.material.color.setHex(0x222427);
      }

      controls.update();
      renderer.render(scene, camera);
    };
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235

    animate();

    // 12. Handle Resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [showTrail]);

  // Sync workspace sphere visibility
  useEffect(() => {
<<<<<<< HEAD
    fetch('/key.config.json')
      .then(r => r.json())
      .then(data => {
         if (data.keys) {
           const arr = Object.keys(data.keys).map(k => ({ name: k, ...data.keys[k] }));
           setKeys(arr);
         }
      })
      .catch(console.error);
  }, []);

  const cx = 0.55;
  const cy = 0;
  const cz = 0.045;
=======
    if (workspaceSphereRef.current) {
      workspaceSphereRef.current.visible = showWorkspace;
    }
  }, [showWorkspace]);
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235

  return (
    <div className="relative w-full h-full min-h-[450px]">
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/5" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#131518]/90 flex flex-col justify-center items-center rounded-xl z-20">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-amber-500 font-mono tracking-wider">LOADING VANTAGE URDF MODEL...</p>
        </div>
      )}

      {/* Error Overlay */}
      {loadError && (
        <div className="absolute inset-0 bg-[#131518]/95 flex flex-col justify-center items-center rounded-xl z-20 text-center p-6">
          <AlertTriangle className="text-red-500 w-16 h-16 mb-4 animate-bounce" />
          <p className="text-red-500 font-mono font-bold text-lg mb-2">URDF LOAD ERROR</p>
          <p className="text-gray-400 font-mono text-sm max-w-md">{loadError}</p>
        </div>
      )}

      {/* Touch indicator */}
      {activeKey && (
        <div className="absolute top-4 left-4 bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 z-10 animate-pulse">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
          <span className="text-emerald-400 font-mono text-xs font-bold uppercase">
            STYLUS TOUCH: KEY {activeKey}
          </span>
        </div>
      )}

      {/* Safety Violation Alert Overlay */}
      {safetyAlert.active && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-950/70 border border-red-500/40 backdrop-blur-md p-4 rounded-xl flex items-start gap-3 z-10 animate-pulse">
          <AlertTriangle className="text-red-500 w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-400 font-mono text-xs font-bold uppercase tracking-wider">
              Safety Shutdown Active
            </h4>
            <p className="text-gray-200 font-mono text-xs mt-1 leading-snug">
              {safetyAlert.msg}
            </p>
          </div>
        </div>
      )}

      {/* Info indicator */}
      {!loading && !loadError && (
        <div className="absolute top-4 right-4 bg-white/5 border border-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 z-10">
          <Info className="text-amber-500/80 w-3.5 h-3.5" />
          <span className="text-white/60 font-mono text-[10px]">L-Click + Drag: Rotate | R-Click: Pan | Scroll: Zoom</span>
        </div>
      )}
    </div>
  );
};
