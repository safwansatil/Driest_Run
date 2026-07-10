import * as THREE from 'three';
import type { JointState, UrdfLimits } from '../types';

export interface CartesianPose {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

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

export function getStylusPose(joints: JointState): CartesianPose {
  const transforms = forwardKinematics(joints);
  const T_tip = transforms[transforms.length - 1];

  const position = new THREE.Vector3().setFromMatrixPosition(T_tip);
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

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M: number[][] = [];
  for (let i = 0; i < n; i++) {
    M.push([...A[i], b[i]]);
  }

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > Math.abs(M[maxRow][i])) {
        maxRow = r;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) return null;

    for (let j = i; j <= n; j++) M[i][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = M[r][i];
        for (let j = i; j <= n; j++) M[r][j] -= factor * M[i][j];
      }
    }
  }
  return M.map(row => row[n]);
}

function multiplyMatrices(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const C: number[][] = Array(rowsA).fill(0).map(() => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) sum += A[i][k] * B[k][j];
      C[i][j] = sum;
    }
  }
  return C;
}

function multiplyMatrixVector(A: number[][], x: number[]): number[] {
  const rows = A.length;
  const cols = A[0].length;
  const y: number[] = Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let sum = 0;
    for (let j = 0; j < cols; j++) sum += A[i][j] * x[j];
    y[i] = sum;
  }
  return y;
}

export function solveIK(
  targetPos: THREE.Vector3,
  targetDir: THREE.Vector3,
  initialJoints: JointState,
  urdfLimits: UrdfLimits,
  maxIterations = 80,
  tolerance = 0.0001
): { joints: JointState; converged: boolean; iterations: number; error: number } {
  
  const currentJoints = { ...initialJoints };
  const jointKeys: (keyof JointState)[] = ['joint_1','joint_2','joint_3','joint_4','joint_5','joint_6','stylus_pitch'];
  const m = 7;

  let converged = false;
  let iterations = 0;
  let error = 100.0;

  const damping = 0.04;
  const alphaStep = 0.5;
  const wDir = 0.3;

  for (iterations = 0; iterations < maxIterations; iterations++) {
    const pose = getStylusPose(currentJoints);
    const currPos = new THREE.Vector3(pose.x, pose.y, pose.z);
    const currDir = new THREE.Vector3(pose.nx, pose.ny, pose.nz);

    const posErr = new THREE.Vector3().subVectors(targetPos, currPos);
    const dirErr = new THREE.Vector3().subVectors(targetDir, currDir);
    
    error = posErr.length() + wDir * dirErr.length();

    if (error < tolerance) {
      converged = true;
      break;
    }

    const J: number[][] = Array(6).fill(0).map(() => Array(m).fill(0));
    const eps = 0.00001;

    for (let j = 0; j < m; j++) {
      const key = jointKeys[j];
      const origVal = currentJoints[key];
      currentJoints[key] = origVal + eps;
      const posePlus = getStylusPose(currentJoints);
      currentJoints[key] = origVal;

      J[0][j] = (posePlus.x - pose.x) / eps;
      J[1][j] = (posePlus.y - pose.y) / eps;
      J[2][j] = (posePlus.z - pose.z) / eps;
      J[3][j] = ((posePlus.nx - pose.nx) / eps) * wDir;
      J[4][j] = ((posePlus.ny - pose.ny) / eps) * wDir;
      J[5][j] = ((posePlus.nz - pose.nz) / eps) * wDir;
    }

    const dx = [posErr.x, posErr.y, posErr.z, dirErr.x * wDir, dirErr.y * wDir, dirErr.z * wDir];

    const JT: number[][] = Array(m).fill(0).map(() => Array(6).fill(0));
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < m; c++) {
        JT[c][r] = J[r][c];
      }
    }

    const JJT = multiplyMatrices(J, JT);
    for (let i = 0; i < 6; i++) JJT[i][i] += damping * damping;

    const w = solveLinearSystem(JJT, dx);
    if (!w) {
      const dqFallback = multiplyMatrixVector(JT, dx);
      for (let j = 0; j < m; j++) {
        const key = jointKeys[j];
        currentJoints[key] += dqFallback[j] * 0.1;
        const limit = urdfLimits[key];
        if (limit) currentJoints[key] = Math.max(limit.min, Math.min(limit.max, currentJoints[key]));
      }
      continue;
    }

    const dtheta_task = multiplyMatrixVector(JT, w);
    const dtheta_null: number[] = Array(m).fill(0);
    
    // Null-space projection towards center of joint limits
    const kNull = 0.05;
    for (let j = 0; j < m; j++) {
      const key = jointKeys[j];
      const limit = urdfLimits[key];
      if (limit) {
         const center = (limit.min + limit.max) / 2.0;
         const range = limit.max - limit.min;
         dtheta_null[j] = -kNull * (2.0 * (currentJoints[key] - center)) / (range * range);
      }
    }

    const J_dq_null = multiplyMatrixVector(J, dtheta_null);
    const w_null = solveLinearSystem(JJT, J_dq_null);
    if (w_null) {
      const J_dagger_J_dq_null = multiplyMatrixVector(JT, w_null);
      for (let j = 0; j < m; j++) {
        dtheta_null[j] = dtheta_null[j] - J_dagger_J_dq_null[j];
      }
    } else {
      dtheta_null.fill(0);
    }

    for (let j = 0; j < m; j++) {
      const key = jointKeys[j];
      currentJoints[key] += dtheta_task[j] * alphaStep + dtheta_null[j];
      const limit = urdfLimits[key];
      if (limit) currentJoints[key] = Math.max(limit.min, Math.min(limit.max, currentJoints[key]));
    }
  }

  return { joints: currentJoints, converged, iterations, error };
}
