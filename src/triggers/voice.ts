import { commandBus } from '../bus/commandBus';
import { parseUtterance, isParseError } from './voice/grammar';

export async function handleVoiceCommand(spokenText: string): Promise<void> {
  const result = parseUtterance(spokenText);
  if (isParseError(result)) {
    return;
  }
  await commandBus.submit(result);
}
