import { PromptFlow } from '../../types/promptFlow';
import { scoringFlows } from './scoringFlows';
import { turnoverFlows } from './turnoverFlows';
import { reboundFlows } from './reboundFlows';
import { foulFlows } from './foulFlows';
import { substitutionFlows } from './substitutionFlows';
import { jumpballFlows } from './jumpballFlows';
import { standaloneFlows } from './standaloneFlows';
import { anomalyFlows } from './anomalyFlows';

export const INITIAL_PROMPT_FLOWS: Record<string, PromptFlow> = {
  ...scoringFlows,
  ...turnoverFlows,
  ...reboundFlows,
  ...foulFlows,
  ...substitutionFlows,
  ...jumpballFlows,
  ...standaloneFlows,
  ...anomalyFlows
};
