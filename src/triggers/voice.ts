import { commandBus } from '../bus/commandBus';
import { parseUtterance, isParseError } from './voice/grammar';

export function handleVoiceCommand(spokenText: string): void {
  const result = parseUtterance(spokenText);
  if (isParseError(result)) {
    return;
  }
  commandBus.submit(result);
}
