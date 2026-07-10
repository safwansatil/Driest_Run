import { useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import { useStore } from '../store';
import type { UrdfLimits } from '../types';
import * as THREE from 'three';

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
        }
      }, undefined, (err: any) => {
         setErrorMsg('URDF load error: ' + (err.message || 'unknown error'));
      });
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

const KeyPanel = () => {
  const [keys, setKeys] = useState<any[]>([]);

  useEffect(() => {
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

  return (
    <group rotation={[-Math.PI/2, 0, 0]}>
      {keys.map((k, i) => (
        <mesh key={i} position={[k.x, k.y, k.z]}>
          <boxGeometry args={[0.02, 0.02, 0.01]} />
          <meshStandardMaterial color="hotpink" />
          <Html position={[0, 0, 0.015]} center>
            <div style={{ color: 'white', fontSize: '10px', background: 'rgba(0,0,0,0.5)', padding: '2px 4px', borderRadius: '4px', userSelect: 'none' }}>
              {k.name}
            </div>
          </Html>
        </mesh>
      ))}
      <mesh position={[cx, cy, cz]}>
         <boxGeometry args={[0.15, 0.15, 0.01]} />
         <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
}

export default function RobotSimulator() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <Canvas shadows camera={{ position: [1.2, 1.2, 1.2], fov: 45 }}>
        <color attach="background" args={['#1a1b1e']} />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[5, 10, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize={2048}
        />
        
        <RobotArm />
        <KeyPanel />
        
        <Grid infiniteGrid fadeDistance={4} sectionColor="#444" cellColor="#222" />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.05} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
