export const toolSchemas = [
  {
    name: 'jog',
    description:
      'Jog a specific joint by an angle in radians, or jog the end effector by a relative Cartesian delta in meters.',
    input_schema: {
      type: 'object',
      properties: {
        jointIndex: {
          type: 'integer',
          minimum: 0,
          maximum: 5,
          description: '0-based joint index (0 to 5) to jog.',
        },
        deltaRad: {
          type: 'number',
          description: 'Angle in radians to jog the joint by.',
        },
        delta: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
          },
          description: 'Cartesian translation delta in meters.',
        },
      },
    },
  },
  {
    name: 'goto',
    description:
      'Move the arm end-effector to a predefined location (like "home") or to specific target Cartesian coordinates in meters.',
    input_schema: {
      type: 'object',
      properties: {
        targetName: {
          type: 'string',
          enum: ['home'],
          description: 'Predefined target name, e.g., "home".',
        },
        target: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
            approach: {
              type: 'array',
              items: { type: 'number' },
              minItems: 3,
              maxItems: 3,
              description: 'Approach direction vector [x, y, z]. Defaults to [0, 0, -1].',
            },
          },
          description: 'Target Cartesian coordinates in meters.',
        },
      },
    },
  },
  {
    name: 'rotate_joint',
    description: 'Rotate a specific joint to an absolute angle in radians.',
    input_schema: {
      type: 'object',
      properties: {
        jointIndex: {
          type: 'integer',
          minimum: 0,
          maximum: 5,
          description: '0-based joint index (0 to 5).',
        },
        absRad: {
          type: 'number',
          description: 'Absolute target angle in radians.',
        },
      },
      required: ['jointIndex', 'absRad'],
    },
  },
  {
    name: 'press_key',
    description: 'Move the arm end-effector to press a specific key (1-6) on the keypad.',
    input_schema: {
      type: 'object',
      properties: {
        keyIndex: {
          type: 'integer',
          minimum: 1,
          maximum: 6,
          description: '1-based key index (1 to 6).',
        },
      },
      required: ['keyIndex'],
    },
  },
  {
    name: 'enter_pin',
    description: 'Enter a 6-digit PIN by pressing the keys sequentially.',
    input_schema: {
      type: 'object',
      properties: {
        digits: {
          type: 'array',
          items: {
            type: 'integer',
            minimum: 1,
            maximum: 6,
          },
          minItems: 6,
          maxItems: 6,
          description: 'Exactly 6 digits (each between 1 and 6).',
        },
      },
      required: ['digits'],
    },
  },
  {
    name: 'estop',
    description: 'Emergency stop: immediately halts the arm and puts it in ESTOPPED state.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'clarify',
    description:
      'Ask the user a clarifying question when the command is ambiguous or missing details.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The clarifying question to ask the user.',
        },
      },
      required: ['question'],
    },
  },
];
