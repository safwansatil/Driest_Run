import { solveIK } from '../src/kinematics';
import { validate } from '../src/validation';
import { HOME_JOINTS, useStore } from '../src/store';
import { parseUrdfLimits } from '../src/kinematics';

async function test() {
  useStore.setState({
    joints: HOME_JOINTS,
    urdfLimits: parseUrdfLimits()
  });

  const keyConfig = {
    "1": { "x": 0.5, "y": 0.25, "z": 0.05 },
    "2": { "x": 0.75, "y": 0.25, "z": 0.05 },
    "3": { "x": 1.0, "y": 0.25, "z": 0.05 }
  };

  for (const [name, keyData] of Object.entries(keyConfig)) {
    const target = { x: keyData.x, y: keyData.y, z: keyData.z, approach: [0, 0, -1] as [number, number, number] };
    const ikResult = solveIK(target, HOME_JOINTS);
    console.log(`IK Result for Key ${name}:`, ikResult);

    const command = {
      id: 'test-uuid',
      source: 'agent' as const,
      type: 'press_key' as const,
      keyIndex: parseInt(name),
      timestamp: Date.now()
    };
    const validationReport = validate(command, ikResult.jointAngles);
    console.log(`Validation Report for Key ${name}:`, validationReport);
  }
}

test().catch(console.error);
