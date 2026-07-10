import { useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
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

  const showGrid = useStore((state) => state.showGrid);

  useEffect(() => {
    // Hardcoded key config to avoid Vite caching issues
    const data = {
      keys: {
        "1": { x: 0.5, y: 0.25, z: 0.05 },
        "2": { x: 0.75, y: 0.25, z: 0.05 },
        "3": { x: 1.0, y: 0.25, z: 0.05 },
        "4": { x: 0.5, y: -0.05, z: 0.05 },
        "5": { x: 0.75, y: -0.05, z: 0.05 },
        "6": { x: 1.0, y: -0.05, z: 0.05 }
      }
    };
    
    const keyArray = Object.entries(data.keys).map(([id, pos]: [string, any]) => ({
      id,
      pos: [pos.x, pos.y, pos.z] as [number, number, number]
    }));
    setKeys(keyArray);
  }, []);

  useEffect(() => {
    try {
      const loader = new URDFLoader();
      loader.load('/6_dof_arm.urdf', (urdf: any) => {
        try {
          urdf.traverse((child: any) => {
            if (child.isMesh) {
              const isJointHub = child.material?.name === 'amber';
              const color = isJointHub ? 0x0066cc : 0xe8e8e8;
              const metalness = isJointHub ? 0.3 : 0.6;
              const roughness = isJointHub ? 0.4 : 0.2;
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
             if (joint.limit && jointName !== 'stylus_pitch') {
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
    }
  });

  if (errorMsg) {
     return (
       <Html center>
         <div style={{ color: 'red', background: 'rgba(255,255,255,0.8)', padding: '10px' }}>
           {errorMsg}
         </div>
       </Html>
     );
  }

  return (
    <>
      {showGrid && <gridHelper args={[5, 50, 0x666666, 0xa0a0a0]} />}
      {robot && <primitive object={robot} />}
      
      {/* Render the keypad */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {keys.map(key => (
          <group key={key.id} position={key.pos}>
            <RoundedBox args={[0.075, 0.075, 0.02]} radius={0.01} smoothness={4} castShadow receiveShadow>
              <meshStandardMaterial color="#111111" roughness={0.6} metalness={0.4} />
            </RoundedBox>
            
            <Text 
              position={[0, 0, 0.012]} 
              fontSize={0.04} 
              color="#00ffcc" 
              anchorX="center" 
              anchorY="middle"
              outlineWidth={0.0005}
              outlineColor="#00ffcc"
            >
              {key.id}
            </Text>
          </group>
        ))}
      </group>
    </>
  );
};

export default RobotSimulator;
