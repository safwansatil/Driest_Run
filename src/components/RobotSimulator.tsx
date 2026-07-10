import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import URDFLoader from 'urdf-loader';
import * as THREE from 'three';
import { useStore } from '../store';
import type { UrdfLimits } from '../types';

const RobotSimulator = () => {
  const joints = useStore((state) => state.joints);
  const setUrdfLimits = useStore((state) => state.setUrdfLimits);
  const [robot, setRobot] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [keys, setKeys] = useState<{ id: string; pos: [number, number, number] }[]>([]);

  useEffect(() => {
    // Fetch key config
    fetch('/key.config.json')
      .then(res => res.json())
      .then(data => {
        const keyArray = Object.entries(data.keys).map(([id, pos]: [string, any]) => ({
          id,
          pos: [pos.x, pos.y, pos.z] as [number, number, number]
        }));
        setKeys(keyArray);
      })
      .catch(err => console.error("Failed to load key config", err));

    try {
      const loader = new URDFLoader();
      loader.load('/6_dof_arm.urdf', (urdf: any) => {
        try {
          urdf.traverse((child: any) => {
            if (child.isMesh) {
              const isJointHub = child.material?.name === 'amber';
              const color = isJointHub ? 0xffb732 : 0x111111;
              const metalness = isJointHub ? 0.4 : 0.8;
              const roughness = isJointHub ? 0.3 : 0.2;
              child.material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
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

  return (
    <>
      <gridHelper args={[5, 50, 0x333333, 0x111111]} />
      {robot && <primitive object={robot} />}
      
      {/* Render the keypad */}
      <group>
        {keys.map(key => (
          <mesh key={key.id} position={key.pos} castShadow receiveShadow>
            <boxGeometry args={[0.04, 0.04, 0.02]} />
            <meshStandardMaterial 
              color={0x00ccff} 
              emissive={0x00ccff} 
              emissiveIntensity={0.5} 
              roughness={0.1} 
              metalness={0.8}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}
      </group>
    </>
  );
};

export default RobotSimulator;
