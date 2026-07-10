import { useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import { useStore } from '../store';
import * as THREE from 'three';

const RobotArm = () => {
  const joints = useStore((state) => state.joints);
  const [robot, setRobot] = useState<any>(null);

  useEffect(() => {
    const loader = new URDFLoader();
    loader.load('/6_dof_arm.urdf', (urdf) => {
      urdf.traverse((child: any) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.2, metalness: 0.6 });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // Ensure the root base is correctly oriented
      urdf.rotation.x = -Math.PI / 2;
      setRobot(urdf);
    });
  }, []);

  useFrame(() => {
    if (robot) {
      if (robot.joints['joint_1']) robot.joints['joint_1'].setAngle(joints.joint_1);
      if (robot.joints['joint_2']) robot.joints['joint_2'].setAngle(joints.joint_2);
      if (robot.joints['joint_3']) robot.joints['joint_3'].setAngle(joints.joint_3);
      if (robot.joints['joint_4']) robot.joints['joint_4'].setAngle(joints.joint_4);
      if (robot.joints['joint_5']) robot.joints['joint_5'].setAngle(joints.joint_5);
      if (robot.joints['joint_6']) robot.joints['joint_6'].setAngle(joints.joint_6);
      if (robot.joints['stylus_pitch']) robot.joints['stylus_pitch'].setAngle(joints.stylus_pitch);
    }
  });

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

  // Panel base center
  const cx = 0.55;
  const cy = 0;
  const cz = 0.045; // Just below keys

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
