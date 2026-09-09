import React, { useState } from 'react';
import { PromptFlow, EventContainer, SecondaryAction, OptionalField, PromptActorScope } from '../../../core/types/promptFlow';
import { INITIAL_PROMPT_FLOWS } from '../../../core/config/initialFlowData';
import { EVENT_CONTAINER_LIBRARY, LibraryContainerTemplate } from '../../../core/config/promptLibrary';
import { RecordingType, RecordingMode, EventType, Match, MatchRoster, Player, GameEvent } from '../../../core/types/stats';
import { PromptFlowRenderer } from '../../../components/tracking/PromptFlowRenderer';
import { StageConfigPanel } from '../components/StageConfigPanel';
import { SimulationSummaryModal } from '../components/SimulationSummaryModal';
import { EventStageLibraryModal } from '../components/EventStageLibraryModal';
import { 
  Plus, Search, Settings2, Trash2, 
  ChevronRight, ArrowRight, Eye, 
  Layout, MousePointer2, User, Users,
  CheckCircle, HelpCircle, Save, X, MoveRight,
  Target, Zap, Ban, Flag, RefreshCw, Activity,
  ChevronLeft, Info, Check, LogIn, Download, Upload,
  ListFilter, ShieldAlert, ZapOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../../core/contexts/ToastContext';

// --- MOCK DATA FOR SIMULATION ---
const MOCK_MATCH: Match = {
  id: 'mock-match',
  matchId: 'mock-match',
  teamId: 'home',
  opponentTeamId: 'away',
  ourTeamName: 'Home Team',
  theirTeamName: 'Away Team',
  recordingType: 'full',
  recordingMode: 'detailed',
  venue: 'Mock Arena',
  date: new Date().toISOString(),
} as any;

const MOCK_ROSTERS: MatchRoster[] = [
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `h${i}`, profileId: `p_h${i}`, teamId: 'home', name: `Home Player ${i+1}`, jerseyNumber: `${10+i}`, isActive: true
  })),
  ...Array.from({ length: 5 }).map((_, i) => ({
    id: `a${i}`, profileId: `p_a${i}`, teamId: 'away', name: `Away Player ${i+1}`, jerseyNumber: `${20+i}`, isActive: true
  })),
] as any;

const MOCK_PLAYERS: Player[] = MOCK_ROSTERS.map(r => ({
  id: r.profileId,
  name: r.name,
  displayName: r.name,
  jersey: r.jerseyNumber,
  isActive: true
}));

const MOCK_TRIGGER_EVENT: GameEvent = {
  id: 'trigger',
  matchId: 'mock-match',
  playerId: 'p_h0',
  type: 'shot',
  timestamp: 120,
  quarter: 1,
  teamId: 'home',
  team: 'home'
} as any;

interface TriggerEntryPoint {
  id: string;
  label: string;
  icon: any;
  flowMapping: Record<RecordingType, string | null>;
  supportedModes: RecordingType[];
}

const TRIGGER_ENTRY_POINTS: TriggerEntryPoint[] = [
  { id: '2pt_make', label: '+2 PT', icon: Zap, flowMapping: { full: 'plus_2pt', team: 'plus_2pt', single: 'plus_2pt' }, supportedModes: ['full', 'team', 'single'] },
  { id: '3pt_make', label: '+3 PT', icon: Zap, flowMapping: { full: 'plus_3pt', team: 'plus_3pt', single: 'plus_3pt' }, supportedModes: ['full', 'team', 'single'] },
  { id: '2pt_miss', label: 'Miss 2PT', icon: X, flowMapping: { full: 'missed_shot', team: 'missed_shot', single: 'missed_shot' }, supportedModes: ['full', 'team', 'single'] },
  { id: '3pt_miss', label: 'Miss 3PT', icon: X, flowMapping: { full: 'missed_shot', team: 'missed_shot', single: 'missed_shot' }, supportedModes: ['full', 'team', 'single'] },
  { id: 'to', label: 'Turnover (TO)', icon: RefreshCw, flowMapping: { full: 'turnover', team: 'turnover', single: 'turnover' }, supportedModes: ['full', 'team', 'single'] },
  { id: 'foul', label: 'Foul', icon: Flag, flowMapping: { full: 'foul', team: 'foul', single: 'foul' }, supportedModes: ['full', 'team', 'single'] },
];

const STYLES = {
  card: "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] shadow-sm",
  input: "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-5 py-3 font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all",
  label: "text-xs font-black uppercase tracking-widest text-zinc-400 ml-4 mb-2",
  modal: "fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-6"
};

export const PromptFlowEditor: React.FC = () => {
  const { showToast } = useToast();
  const [flows, setFlows] = useState<Record<string, PromptFlow>>(INITIAL_PROMPT_FLOWS);
  const [selectedTriggerId, setSelectedTriggerId] = useState<string>(TRIGGER_ENTRY_POINTS[0].id);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<RecordingType>('full');
  const [previewLevel, setPreviewLevel] = useState<RecordingMode>('detailed');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
  const [simulationLogs, setSimulationLogs] = useState<any[]>([]);
  const [isSimulationFinished, setIsSimulationFinished] = useState(false);

  const filteredTriggers = TRIGGER_ENTRY_POINTS.filter(t => t.supportedModes.includes(previewMode));

  const currentTrigger = TRIGGER_ENTRY_POINTS.find(t => t.id === selectedTriggerId);
  const selectedFlowId = currentTrigger?.flowMapping[previewMode];
  const selectedFlow = selectedFlowId ? flows[selectedFlowId] : null;
  const selectedContainer = selectedContainerId ? selectedFlow?.containers[selectedContainerId] : null;

  const handleUpdateContainer = (containerId: string, updates: Partial<EventContainer>) => {
    if (!selectedFlowId) return;
    const updatedFlow = {
      ...flows[selectedFlowId],
      containers: {
        ...flows[selectedFlowId].containers,
        [containerId]: { ...flows[selectedFlowId].containers[containerId], ...updates }
      }
    };
    setFlows(prev => ({ ...prev, [selectedFlowId]: updatedFlow }));
  };

  const handleMoveContainer = (containerId: string, direction: 'up' | 'down') => {
    if (!selectedFlowId || !selectedFlow) return;
    const containerIds = Object.keys(selectedFlow.containers);
    const index = containerIds.indexOf(containerId);
    if (index === -1) return;
    
    const newContainers = { ...selectedFlow.containers };
    const newContainerIds = [...containerIds];
    
    if (direction === 'up' && index > 0) {
      [newContainerIds[index], newContainerIds[index - 1]] = [newContainerIds[index - 1], newContainerIds[index]];
    } else if (direction === 'down' && index < containerIds.length - 1) {
      [newContainerIds[index], newContainerIds[index + 1]] = [newContainerIds[index + 1], newContainerIds[index]];
    } else return;

    const reorderedContainers: Record<string, EventContainer> = {};
    newContainerIds.forEach(id => { reorderedContainers[id] = newContainers[id]; });

    setFlows(prev => ({
      ...prev,
      [selectedFlowId]: { ...prev[selectedFlowId], containers: reorderedContainers }
    }));
  };

  const handleLibrarySelect = (template: LibraryContainerTemplate) => {
    if (!selectedFlowId || !selectedFlow) return;
    const baseId = template.id || 'new_container';
    let newId = baseId;
    let counter = 1;
    while (selectedFlow.containers[newId]) {
      newId = `${baseId}_${counter}`;
      counter++;
    }

    const newContainer: EventContainer = {
      id: newId,
      name: template.name || 'New Stage',
      triggerContext: template.triggerContext || 'custom',
      supportedModes: template.supportedModes || ['full', 'team', 'single'],
      supportedDetailLevels: template.supportedDetailLevels || ['detailed', 'lite'],
      ui: template.ui || { layout: 'single_screen' },
      primaryAction: template.primaryAction || { type: 'event', eventType: 'shot' as any },
      secondaryActions: template.secondaryActions || [],
      optionalFields: template.optionalFields || [],
    };

    handleUpdateContainer(newId, newContainer);
    setIsLibraryOpen(false);
    setSelectedContainerId(newId);
  };

  const handleExportJSON = () => {
    const backup = {
      version: "event_container_v2",
      metadata: {
        exportedAt: new Date().toISOString(),
        editorVersion: "2.0.0",
        author: "Admin"
      },
      flows
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `prompt_flows_v2_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.version === "event_container_v2") {
          setFlows(json.flows);
        } else {
          // Legacy support or fallback
          setFlows(json);
        }
        setSelectedContainerId(null);
        showToast('Prompt flows imported successfully.', 'success');
      } catch (err) {
        showToast('Failed to import JSON. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Simulation Modal (Unified Renderer) */}
      <AnimatePresence>
        {isPreviewOpen && selectedFlow && (
          <div className="fixed inset-0 z-[100]">
            {!isSimulationFinished ? (
              <PromptFlowRenderer
                flow={selectedFlow}
                match={{ ...MOCK_MATCH, recordingType: previewMode, recordingMode: previewLevel }}
                matchRosters={MOCK_ROSTERS}
                allPlayers={MOCK_PLAYERS}
                triggerEvent={MOCK_TRIGGER_EVENT}
                onComplete={(logs) => { setSimulationLogs(logs); setIsSimulationFinished(true); }}
                onCancel={() => setIsPreviewOpen(false)}
                isSimulation={true}
              />
            ) : (
              <SimulationSummaryModal 
                simulationLogs={simulationLogs}
                setIsPreviewOpen={setIsPreviewOpen}
                setIsSimulationFinished={setIsSimulationFinished}
              />
            )}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLibraryOpen && (
          <EventStageLibraryModal 
            setIsLibraryOpen={setIsLibraryOpen}
            handleLibrarySelect={handleLibrarySelect}
          />
        )}
      </AnimatePresence>

      {/* Main UI */}
      <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-xl font-black italic tracking-tighter text-zinc-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-orange" />
            TRIGGER ENTRY
          </h1>
        </div>
        <div className="p-4 space-y-2">
          {filteredTriggers.map(trigger => {
            const isSelected = selectedTriggerId === trigger.id;
            return (
              <button 
                key={trigger.id} 
                onClick={() => { setSelectedTriggerId(trigger.id); setSelectedContainerId(null); }}
                className={`w-full text-left p-4 rounded-2xl transition-all border group ${isSelected ? "bg-brand-orange text-white border-transparent shadow-lg scale-[1.02]" : "bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-100"}`}
              >
                <div className="flex items-center gap-3">
                  <trigger.icon className="w-4 h-4" />
                  <span className="font-black italic text-sm uppercase tracking-wider">{trigger.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <button onClick={() => window.location.href = '/'} className="p-2 border rounded-xl"><ChevronLeft className="w-4 h-4" /></button>
             <h2 className="text-sm font-black italic uppercase italic uppercase tracking-widest">{selectedFlow?.name || 'No Flow'}</h2>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={handleExportJSON} className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-zinc-600 dark:text-zinc-300">
                <Download className="w-4 h-4" /> Save Backup
             </button>
             <label className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer text-zinc-600 dark:text-zinc-300">
                <Upload className="w-4 h-4" /> Import Data
                <input type="file" className="hidden" onChange={handleImportJSON}/>
             </label>
             <button 
                onClick={() => setIsPreviewOpen(true)}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-brand-orange text-white font-black italic uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all ml-4"
             >
               <Activity className="w-4 h-4" /> Start Simulation
             </button>
           </div>
        </header>

        <main className="flex-1 overflow-x-auto p-12 bg-[#F8F9FB] dark:bg-black/20">
          {selectedFlow && (
            <div className="flex flex-col items-center gap-0 min-w-max pb-32">
              {Object.values(selectedFlow.containers).map((container, i) => (
                <div key={container.id} className="relative flex flex-col items-center">
                  {i > 0 && <div className="w-0.5 h-12 bg-zinc-200 dark:bg-zinc-800" />}
                  <div onClick={() => setSelectedContainerId(container.id)} className={`w-[500px] p-6 ${STYLES.card} cursor-pointer transition-all ${selectedContainerId === container.id ? 'ring-4 ring-brand-orange shadow-xl scale-[1.02] z-10' : 'hover:border-brand-orange hover:shadow-md'}`}>
                  <div className="flex items-center justify-between mb-2">
                     <h4 className="font-black italic uppercase tracking-tighter text-xl">{container.name}</h4>
                     <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleMoveContainer(container.id, 'up'); }} className="p-1 px-2 border rounded-lg bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 transition-colors" disabled={i === 0}>↑</button>
                        <button onClick={(e) => { e.stopPropagation(); handleMoveContainer(container.id, 'down'); }} className="p-1 px-2 border rounded-lg bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 transition-colors" disabled={i === Object.values(selectedFlow.containers).length - 1}>↓</button>
                     </div>
                  </div>
                  <div className="text-xs font-black uppercase text-zinc-400 mb-6 font-mono">Stage ID: {container.id}</div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                       <div className="text-xs font-black uppercase tracking-widest text-brand-orange mb-1">Primary Logic</div>
                       <div className="text-xs font-bold">{container.primaryAction.eventType} {container.primaryAction.options ? `(${container.primaryAction.options.join('/')})` : ''}</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                       <div className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-1">Secondary & Context</div>
                       <div className="text-xs font-bold leading-tight">
                         {container.secondaryActions.length} Actions<br/>
                         {container.optionalFields?.length || 0} Optional Fields
                       </div>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl space-y-3 border border-blue-100 dark:border-blue-900/20">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-500">
                       <Activity className="w-3 h-3" /> Navigation Paths
                    </div>
                    
                    {container.branchingRules?.map(rule => (
                      <div key={rule.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-bold bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="text-brand-orange">If {rule.conditionType.replace('Choice', '').replace('Action', '').replace('Field', '')} {rule.targetId ? `[${rule.targetId}]` : ''} {rule.operator.replace('_', ' ')} '{rule.value}'</span>
                        <ArrowRight className="w-3 h-3 text-zinc-300 hidden sm:block flex-shrink-0" />
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs break-all">{rule.nextContainerId}</span>
                      </div>
                    ))}
                    
                    {/* Fallback Legacy Branching */}
                    {container.branching && Object.entries(container.branching).map(([key, nextId]) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-bold bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <span className="text-zinc-600 dark:text-zinc-300">If choice is '{key}'</span>
                        <ArrowRight className="w-4 h-4 text-zinc-300 hidden sm:block flex-shrink-0" />
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs break-all">{nextId}</span>
                      </div>
                    ))}

                    {/* Default Next Stage */}
                    {container.nextContainerId && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                        <span className="text-emerald-700 dark:text-emerald-400">Default Next Step</span>
                        <ArrowRight className="w-4 h-4 text-emerald-300 hidden sm:block flex-shrink-0" />
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-1 rounded text-xs break-all">{container.nextContainerId}</span>
                      </div>
                    )}

                    {!container.nextContainerId && !container.branching && (!container.branchingRules || container.branchingRules.length === 0) && (
                      <div className="text-xs font-black uppercase italic text-zinc-400 py-1">Ends the flow here.</div>
                    )}
                  </div>

                </div>
                </div>
              ))}
              
              <div className="relative flex flex-col items-center">
                <div className="w-0.5 h-12 bg-zinc-200 dark:bg-zinc-800" />
                <button onClick={() => setIsLibraryOpen(true)} className="relative px-10 py-5 bg-white dark:bg-zinc-900 rounded-[2rem] border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 font-black italic uppercase tracking-widest hover:border-brand-orange hover:text-brand-orange hover:shadow-lg transition-all z-10 w-[500px]">
                  + Add New Event Stage
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedContainer && selectedFlowId && selectedFlow && (
        <StageConfigPanel 
          selectedContainer={selectedContainer}
          selectedFlowId={selectedFlowId}
          selectedFlow={selectedFlow}
          handleUpdateContainer={handleUpdateContainer}
          setFlows={setFlows}
          setSelectedContainerId={setSelectedContainerId}
        />
      )}
    </div>
  );
};
