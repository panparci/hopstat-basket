import { PromptFlow, EventContainer } from '../types/promptFlow';
import { Match, RecordingType, RecordingMode } from '../types/stats';
import { INITIAL_PROMPT_FLOWS } from '../config/initialFlowData';
import { FlowFactory } from '../config/flows/factory';

export class PromptService {
  /**
   * Get all registered prompt flows
   */
  static getAllFlows(): PromptFlow[] {
    return Object.values(INITIAL_PROMPT_FLOWS);
  }

  /**
   * Get a specific flow by ID or context
   */
  static getFlow(flowId: string, match?: Match): PromptFlow | undefined {
    // 1. Cek FlowFactory dulu (Struktur Modular Opsi 3)
    if (match) {
      const modularFlow = FlowFactory.getFlow(
        flowId, 
        match.recordingType || 'team', 
        match.recordingMode || 'lite'
      );
      if (modularFlow) return modularFlow;
    }

    // 2. Fallback ke konfigurasi lama
    return INITIAL_PROMPT_FLOWS[flowId];
  }

  /**
   * Determine the next valid container in a flow
   */
  static getNextContainer(
    flow: PromptFlow, 
    currentContainerId: string, 
    match: Match,
    selections?: Record<string, any>
  ): EventContainer | null {
    const currentContainer = flow.containers[currentContainerId];
    if (!currentContainer) return null;

    // 1. Check advanced branching rules first
    let nextId = currentContainer.nextContainerId;
    if (currentContainer.branchingRules && selections) {
       for (const rule of currentContainer.branchingRules) {
         let matchRule = false;
         let checkVal: any;
         
         if (rule.conditionType === 'primaryChoice') {
           checkVal = selections.primaryChoice;
         } else if (rule.conditionType === 'optionalField') {
           checkVal = selections[`field_${rule.targetId}`];
         } else if (rule.conditionType === 'secondaryAction') {
           checkVal = selections[`secondary_${rule.targetId}`];
         }

         if (rule.operator === 'equals' && checkVal === rule.value) matchRule = true;
         if (rule.operator === 'not_equals' && checkVal !== rule.value) matchRule = true;
         if (rule.operator === 'exists' && (checkVal !== undefined && checkVal !== null && checkVal !== false && checkVal !== '')) matchRule = true;
         if (rule.operator === 'not_exists' && (checkVal === undefined || checkVal === null || checkVal === false || checkVal === '')) matchRule = true;

         if (matchRule) {
           nextId = rule.nextContainerId;
           break; // the first matching rule dictates the path
         }
       }
    } else if (currentContainer.branching && selections?.primaryChoice) {
      // Fallback to simpler branching map
      const branchedId = currentContainer.branching[selections.primaryChoice];
      if (branchedId) nextId = branchedId;
    }

    if (!nextId) return null;

    const nextContainer = flow.containers[nextId];
    if (!nextContainer) return null;

    // Visibility rules based on mode and level
    const isVisible = this.isContainerVisible(nextContainer, match.recordingType, match.recordingMode || 'detailed');
    
    if (isVisible) {
      return nextContainer;
    } else {
      // If not visible, recursively find the next one
      return this.getNextContainer(flow, nextId, match, selections);
    }
  }

  /**
   * Check if a container should be shown in the current match context
   */
  static isContainerVisible(container: EventContainer, mode: RecordingType, level: RecordingMode): boolean {
    if (container.supportedModes && !container.supportedModes.includes(mode)) {
      return false;
    }
    if (container.supportedDetailLevels && !container.supportedDetailLevels.includes(level)) {
      return false;
    }
    return true;
  }
}
