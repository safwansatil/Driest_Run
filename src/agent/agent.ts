import { callLLM } from './llmClient';
import { toolSchemas } from './tools';
import { commandBus } from '../bus/commandBus';
import { auditLog } from '../audit';
import { speak } from './tts';
import { useAgentStore } from './agentStore';
import { useStore } from '../store';


let resolveUserReply: ((text: string) => void) | null = null;

export function supplyUserReply(text: string) {
  if (resolveUserReply) {
    resolveUserReply(text);
    resolveUserReply = null;
  }
}

function waitForUserReply(): Promise<string> {
  return new Promise<string>((resolve) => {
    resolveUserReply = resolve;
  });
}

export async function runAgent(userText: string) {
  const store = useAgentStore.getState();

  // If we are currently waiting for a user clarification reply
  if (store.waitingForClarification) {
    store.addMessage({
      sender: 'user',
      text: userText,
      type: 'text'
    });
    supplyUserReply(userText);
    return;
  }

  store.setThinking(true);
  store.setError(null);
  store.addMessage({
    sender: 'user',
    text: userText,
    type: 'text'
  });

  const apiMessages: any[] = [
    { role: 'user', content: userText }
  ];

  const systemPrompt = `You are a robotic arm control assistant for the Vantage 6-DOF arm. 
The arm has a reach of ~1.19 meters (any Cartesian target must be within 1.19 meters radius from the base, where base is at (0,0,0)).
The key coordinates from key.config.json are:
- Key 1: {"x": 0.5, "y": 0.05, "z": 0.05}
- Key 2: {"x": 0.55, "y": 0.05, "z": 0.05}
- Key 3: {"x": 0.6, "y": 0.05, "z": 0.05}
- Key 4: {"x": 0.5, "y": -0.05, "z": 0.05}
- Key 5: {"x": 0.55, "y": -0.05, "z": 0.05}
- Key 6: {"x": 0.6, "y": -0.05, "z": 0.05}

The workspace forbidden zones are: target coordinates with z < 0 are forbidden (ground collision limits).

Tool Selection Guidelines:
- If the user specifies rotating a joint/base "by X degrees" or simply "X degrees" (e.g., "rotate base 30 degrees", "rotate joint 1 by 10 degrees"), this is a relative rotation. You MUST call the 'jog' tool with jointIndex and deltaRad (converted to radians).
- If the user specifies rotating a joint/base "to X degrees" (e.g., "rotate base to 30 degrees"), this is an absolute rotation. You MUST call the 'rotate_joint' tool with jointIndex and absRad (converted to radians).

You must call clarify() rather than guess coordinates when the target or key is ambiguous, or when instructions lack necessary details.
Always formulate commands exactly matching the tool definitions. You can propose commands or ask for clarification.
Any proposed motion will be sent to the safety/validation gate. If rejected, you will be given the reason to re-plan.`;

  let maxAttempts = 3; // Initial proposal + max 2 retries
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const llmResponse = await callLLM(apiMessages, toolSchemas, { system: systemPrompt });
      
      const content = llmResponse.content || [];
      const toolUseBlock = content.find(block => block.type === 'tool_use');
      const textBlock = content.find(block => block.type === 'text');
      
      const assistantText = textBlock?.text || '';

      if (toolUseBlock) {
        const { name, input, id: toolUseId } = toolUseBlock;
        if (!name) {
          throw new Error('Tool use block is missing a name');
        }

        store.addMessage({
          sender: 'agent',
          text: `Proposing action: ${name}`,
          type: 'tool_call',
          toolCallName: name,
          toolCallArgs: input
        });

        if (name === 'clarify') {
          const question = input.question;
          store.addMessage({
            sender: 'agent',
            text: question,
            type: 'clarify'
          });

          if (store.speakResult) {
            speak(question);
          }

          store.setWaitingForClarification(true);
          store.setThinking(false);
          const replyText = await waitForUserReply();
          store.setWaitingForClarification(false);
          store.setThinking(true);

          apiMessages.push({
            role: 'assistant',
            content: [
              { type: 'text', text: assistantText },
              toolUseBlock
            ]
          });

          apiMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: `User response: ${replyText}`
              }
            ]
          });

          // Also push as a normal message for conversation continuity
          apiMessages.push({
            role: 'user',
            content: replyText
          });

          continue;
        }

        const command = mapToolCallToCommand(name, input);
        if (!command) {
          throw new Error(`Failed to map tool call ${name} to ArmCommand`);
        }

        const verdict = await commandBus.dispatch(command);

        if (verdict === 'ACCEPTED') {
          const successMsg = `Action succeeded: ${name} executed successfully.`;
          store.addMessage({
            sender: 'agent',
            text: successMsg,
            type: 'confirmation'
          });

          if (store.speakResult) {
            speak(`Action succeeded: ${name}`);
          }

          // Wait for the arm joints to settle if it is a motion command (and not running in test mode)
          if (name !== 'estop' && name !== 'clarify' && name !== 'enter_pin' && !(typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
            await new Promise<void>((resolve) => {
              let lastJoints = { ...useStore.getState().joints };
              let unchangedTicks = 0;

              const interval = setInterval(() => {
                const state = useStore.getState();
                if (state.mode === 'ERROR' || state.isEStop) {
                  clearInterval(interval);
                  resolve();
                  return;
                }

                const currentJoints = state.joints;
                const diffSq = 
                  Math.pow(currentJoints.joint_1 - lastJoints.joint_1, 2) +
                  Math.pow(currentJoints.joint_2 - lastJoints.joint_2, 2) +
                  Math.pow(currentJoints.joint_3 - lastJoints.joint_3, 2) +
                  Math.pow(currentJoints.joint_4 - lastJoints.joint_4, 2) +
                  Math.pow(currentJoints.joint_5 - lastJoints.joint_5, 2) +
                  Math.pow(currentJoints.joint_6 - lastJoints.joint_6, 2);

                if (diffSq < 0.000001) {
                  unchangedTicks++;
                  if (unchangedTicks >= 4) { // ~200ms
                    clearInterval(interval);
                    resolve();
                  }
                } else {
                  unchangedTicks = 0;
                }
                lastJoints = { ...currentJoints };
              }, 50);
            });
          }

          // Feed successful tool result back to LLM context
          apiMessages.push({
            role: 'assistant',
            content: [
              ...(assistantText ? [{ type: 'text', text: assistantText }] : []),
              toolUseBlock
            ]
          });

          apiMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: `Tool executed successfully.`
              }
            ]
          });

          attempt = 0; // Reset attempts on successful execution
          continue; // Loop again to let LLM decide next step
        } else {
          attempt++;
          const logs = auditLog.getLog();
          const lastLog = logs[logs.length - 1];
          const reason = lastLog?.reason || 'VALIDATION_FAILED';

          const rejectMsg = `Action rejected: ${reason}`;
          store.addMessage({
            sender: 'agent',
            text: rejectMsg,
            type: 'rejection'
          });

          if (attempt >= maxAttempts) {
            const failureMsg = `Failed after max retries. Last rejection reason: ${reason}.`;
            store.addMessage({
              sender: 'system',
              text: failureMsg
            });
            if (store.speakResult) {
              speak(`Action failed: ${reason}`);
            }
            store.setThinking(false);
            return;
          }

          apiMessages.push({
            role: 'assistant',
            content: [
              { type: 'text', text: assistantText },
              toolUseBlock
            ]
          });

          apiMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: `Safety gate rejection: ${reason}. Please adjust parameters and try again.`
              }
            ]
          });
        }
      } else {
        if (assistantText) {
          store.addMessage({
            sender: 'agent',
            text: assistantText,
            type: 'text'
          });
          if (store.speakResult) {
            speak(assistantText);
          }
        }
        store.setThinking(false);
        return;
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message === 'server-key-missing'
        ? 'ANTHROPIC_API_KEY missing on server; add it in Vercel env'
        : (err.message || 'An error occurred during execution');
      
      store.setError(errMsg);
      store.setThinking(false);
      return;
    }
  }
}

function mapToolCallToCommand(name: string, input: any): any {
  const common = {
    id: crypto.randomUUID(),
    source: 'agent' as any,
    timestamp: Date.now()
  };

  switch (name) {
    case 'jog': {
      if (input.delta) {
        return { ...common, type: 'jog', delta: input.delta };
      }
      return { ...common, type: 'jog', jointIndex: input.jointIndex, deltaRad: input.deltaRad };
    }
    case 'goto': {
      if (input.targetName === 'home') {
        return { ...common, type: 'goto', targetName: 'home' };
      }
      return { ...common, type: 'moveTo', target: input.target };
    }
    case 'rotate_joint': {
      return { ...common, type: 'rotate_joint', jointIndex: input.jointIndex, absRad: input.absRad };
    }
    case 'press_key': {
      return { ...common, type: 'press_key', keyIndex: input.keyIndex };
    }
    case 'enter_pin': {
      return { ...common, type: 'enter_pin', digits: input.digits };
    }
    case 'estop': {
      return { ...common, type: 'estop' };
    }
    default:
      return null;
  }
}
