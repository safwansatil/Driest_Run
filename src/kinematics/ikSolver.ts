import * as THREE from 'three';
import { JointState, CartesianPose } from '../types';

// Joint Limits from URDF
export const JOINT_LIMITS = {
  joint_1: { min: -3.1416, max: 3.1416 },
  joint_2: { min: -2.0944, max: 2.0944 },
  joint_3: { min: -2.6180, max: 2.6180 },
  joint_4: { min: -3.1416, max: 3.1416 },
  joint_5: { min: -2.0944, max: 2.0944 },
  joint_6: { min: -3.1416, max: 3.1416 },
  stylus_pitch: { min: -2.0944, max: 2.0944 },
};

// Default neutral home angles
export const HOME_JOINTS: JointState = {
  joint_1: 0,
  joint_2: 0,
  joint_3: 0,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
  stylus_pitch: 0,
};

// Forward Kinematics: Computes the transformation matrices for each link in the base frame
export function forwardKinematics(joints: JointState): THREE.Matrix4[] {
  const T_base = new THREE.Matrix4().identity();

  // J1: base yaw (Z) at z = 0.060
  const T_j1 = new THREE.Matrix4()
    .makeTranslation(0, 0, 0.060)
    .multiply(new THREE.Matrix4().makeRotationZ(joints.joint_1));

  // J2: shoulder pitch (Y) at z = 0.250 relative to link_1
  const T_j2 = T_j1.clone().multiply(
    new THREE.Matrix4()
      .makeTranslation(0, 0, 0.250)
      .multiply(new THREE.Matrix4().makeRotationY(joints.joint_2))
  );

  // J3: elbow pitch (Y) at z = 0.250 relative to link_2
  const T_j3 = T_j2.clone().multiply(
    new THREE.Matrix4()
      .makeTranslation(0, 0, 0.250)
      .multiply(new THREE.Matrix4().makeRotationY(joints.joint_3))
  );

  // J4: forearm roll (Z) at z = 0.250 relative to link_3
  const T_j4 = T_j3.clone().multiply(
    new THREE.Matrix4()
      .makeTranslation(0, 0, 0.250)
      .multiply(new THREE.Matrix4().makeRotationZ(joints.joint_4))
  );

  // J5: wrist pitch (Y) at z = 0.150 relative to link_4
  const T_j5 = T_j4.clone().multiply(
    new THREE.Matrix4()
      .makeTranslation(0, 0, 0.150)
      .multiply(new THREE.Matrix4().makeRotationY(joints.joint_5))
  );

  // J6: tool roll (Z) at z = 0.250 relative to link_5
  const T_j6 = T_j5.clone().multiply(
    new THREE.Matrix4()
      .makeTranslation(0, 0, 0.250)
      .multiply(new THREE.Matrix4().makeRotationZ(joints.joint_6))
  );

  // J7 (stylus_pitch): stylus pitch (Y) at z = 0.150 relative to link_6
  const T_stylus = T_j6.clone().multiply(
    new THREE.Matrix4()
      .makeTranslation(0, 0, 0.150)
      .multiply(new THREE.Matrix4().makeRotationY(joints.stylus_pitch))
  );

  // Stylus Tip Frame: fixed translation z = 0.137 relative to stylus
  const T_tip = T_stylus.clone().multiply(
    new THREE.Matrix4().makeTranslation(0, 0, 0.137)
  );

  return [T_base, T_j1, T_j2, T_j3, T_j4, T_j5, T_j6, T_stylus, T_tip];
}

// Extract the stylus tip position and direction from relative transform matrices
export function getStylusPose(joints: JointState): CartesianPose {
  const transforms = forwardKinematics(joints);
  const T_tip = transforms[transforms.length - 1]; // Stylus tip matrix

  const position = new THREE.Vector3().setFromMatrixPosition(T_tip);

  // The stylus pointing direction is the Z-axis of the tip/stylus coordinate frame.
  const zAxis = new THREE.Vector3(
    T_tip.elements[8],
    T_tip.elements[9],
    T_tip.elements[10]
  ).normalize();

  return {
    x: position.x,
    y: position.y,
    z: position.z,
    nx: zAxis.x,
    ny: zAxis.y,
    nz: zAxis.z,
  };
}

// Gauss-Jordan elimination linear system solver for Ax = b
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M: number[][] = [];
  for (let i = 0; i < n; i++) {
    M.push([...A[i], b[i]]);
  }

  for (let i = 0; i < n; i++) {
    // Find pivot row
    let maxRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[maxRow][i])) {
        maxRow = r;
      }
    }

    // Swap
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) {
      return null; // Singular or ill-conditioned matrix
    }

    // Normalize row i
    for (let j = i; j <= n; j++) {
      M[i][j] /= pivot;
    }

    // Eliminate other rows
    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = M[r][i];
        for (let j = i; j <= n; j++) {
          M[r][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map(row => row[n]);
}

// Matrix multiplication C = A * B
function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const C: number[][] = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

// Matrix-Vector multiplication y = A * x
function multiplyMatrixVector(A: number[][], x: number[]): number[] {
  const rows = A.length;
  const cols = A[0].length;
  const y: number[] = Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) {
      sum += A[i][j] * x[j];
    }
    y[i] = sum;
  }
  return y;
}

// Custom numerical Damped Least Squares IK solver
export function solveIK(
  targetPos: THREE.Vector3,
  targetDir: THREE.Vector3, // Target stylus pointing direction (usually [0, 0, -1] for downward)
  initialJoints: JointState,
  activeMask: boolean[] = [true, true, true, true, true, true, true], // J1-J7 active joints
  maxIterations = 80,
  tolerance = 0.0001
): { joints: JointState; converged: boolean; iterations: number; error: number } {
  
  const currentJoints = { ...initialJoints };
  const jointKeys: (keyof JointState)[] = [
    'joint_1',
    'joint_2',
    'joint_3',
    'joint_4',
    'joint_5',
    'joint_6',
    'stylus_pitch',
  ];

  // Active indices in our joint array
  const activeIndices: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (activeMask[i]) activeIndices.push(i);
  }
  const m = activeIndices.length; // Number of active joints (typically 6 or 7)

  let converged = false;
  let iterations = 0;
  let error = 100.0;

  // Damping factor for DLS
  const damping = 0.04;
  // Step size multiplier
  const alphaStep = 0.5;
  // Weight of orientation error relative to position error
  const wDir = 0.3;

  for (iterations = 0; iterations < maxIterations; iterations++) {
    // 1. Forward Kinematics
    const pose = getStylusPose(currentJoints);
    const currPos = new THREE.Vector3(pose.x, pose.y, pose.z);
    const currDir = new THREE.Vector3(pose.nx, pose.ny, pose.nz);

    // 2. Compute error
    const posErr = new THREE.Vector3().subVectors(targetPos, currPos);
    const dirErr = new THREE.Vector3().subVectors(targetDir, currDir);
    
    const posErrNorm = posErr.length();
    const dirErrNorm = dirErr.length();
    
    error = posErrNorm + wDir * dirErrNorm;

    if (error < tolerance) {
      converged = true;
      break;
    }

    // 3. Compute Numerical Jacobian (6 x m)
    const J: number[][] = Array(6).fill(0).map(() => Array(m).fill(0));
    const eps = 0.00001;

    for (let j = 0; j < m; j++) {
      const idx = activeIndices[j];
      const key = jointKeys[idx];

      // Save nominal joint value
      const origVal = currentJoints[key];

      // Perturb positively
      currentJoints[key] = origVal + eps;
      const posePlus = getStylusPose(currentJoints);

      // Restore
      currentJoints[key] = origVal;

      // Calculate derivatives
      const dPos = new THREE.Vector3(
        (posePlus.x - pose.x) / eps,
        (posePlus.y - pose.y) / eps,
        (posePlus.z - pose.z) / eps
      );
      const dDir = new THREE.Vector3(
        (posePlus.nx - pose.nx) / eps,
        (posePlus.ny - pose.ny) / eps,
        (posePlus.nz - pose.nz) / eps
      );

      J[0][j] = dPos.x;
      J[1][j] = dPos.y;
      J[2][j] = dPos.z;
      J[3][j] = dDir.x * wDir;
      J[4][j] = dDir.y * wDir;
      J[5][j] = dDir.z * wDir;
    }

    // Task velocity vector dx (size 6)
    const dx = [
      posErr.x,
      posErr.y,
      posErr.z,
      dirErr.x * wDir,
      dirErr.y * wDir,
      dirErr.z * wDir,
    ];

    // 4. Solve Damped Least Squares: J^T * inv(J * J^T + lambda^2 * I) * dx
    // Compute A = J * J^T (size 6 x 6)
    const JT: number[][] = Array(m).fill(0).map(() => Array(6).fill(0));
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < m; c++) {
        JT[c][r] = J[r][c];
      }
    }

    const JJT = multiplyMatrices(J, JT);

    // Add damping to diagonal
    for (let i = 0; i < 6; i++) {
      JJT[i][i] += damping * damping;
    }

    // Solve (J*J^T + lambda^2*I) * w = dx for w (size 6)
    const w = solveLinearSystem(JJT, dx);
    if (!w) {
      // Linear system solver failed, fallback to Jacobian Transpose
      const dqFallback = multiplyMatrixVector(JT, dx);
      for (let j = 0; j < m; j++) {
        const idx = activeIndices[j];
        const key = jointKeys[idx];
        currentJoints[key] += dqFallback[j] * 0.1;
        // Clamp to joint limits
        currentJoints[key] = Math.max(JOINT_LIMITS[key].min, Math.min(JOINT_LIMITS[key].max, currentJoints[key]));
      }
      continue;
    }

    // Primary task update: dtheta_task = J^T * w (size m)
    const dtheta_task = multiplyMatrixVector(JT, w);

    // 5. Secondary Objective: Null-space optimization
    // We only apply this if we have redundancy (m > 6)
    const dtheta_null: number[] = Array(m).fill(0);
    if (m > 6) {
      const kNull = 0.05; // Null space step gain
      // Define H(theta) gradient to push joints towards limit center
      for (let j = 0; j < m; j++) {
        const idx = activeIndices[j];
        const key = jointKeys[idx];
        const minVal = JOINT_LIMITS[key].min;
        const maxVal = JOINT_LIMITS[key].max;
        const center = (minVal + maxVal) / 2.0;
        const range = maxVal - minVal;

        // Push to center
        dtheta_null[j] = -kNull * (2.0 * (currentJoints[key] - center)) / (range * range);
      }

      // Project null space: dq_opt = (I - J^dagger * J) * dq_null
      // J^dagger = J^T * inv(J*J^T + lambda^2*I)
      // So J^dagger * J * dq_null = J^T * w_null where JJT * w_null = J * dq_null
      const J_dq_null = multiplyMatrixVector(J, dtheta_null);
      const w_null = solveLinearSystem(JJT, J_dq_null);
      if (w_null) {
        const J_dagger_J_dq_null = multiplyMatrixVector(JT, w_null);
        for (let j = 0; j < m; j++) {
          dtheta_null[j] = dtheta_null[j] - J_dagger_J_dq_null[j];
        }
      } else {
        // Fallback: clear null space step if system is singular
        dtheta_null.fill(0);
      }
    }

    // 6. Apply updates
    for (let j = 0; j < m; j++) {
      const idx = activeIndices[j];
      const key = jointKeys[idx];
      const delta = dtheta_task[j] * alphaStep + dtheta_null[j];
      currentJoints[key] += delta;

      // Clamp to limits
      currentJoints[key] = Math.max(
        JOINT_LIMITS[key].min,
        Math.min(JOINT_LIMITS[key].max, currentJoints[key])
      );
    }
  }

  return {
    joints: currentJoints,
    converged,
    iterations,
    error,
  };
}
