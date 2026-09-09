import React from 'react';
import { PromptFlow, EventContainer, SecondaryAction, OptionalField } from '../../../core/types/promptFlow';
import { Trash2, X } from 'lucide-react';

const STYLES = {
  input: "w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl px-5 py-3 font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-brand-orange/20 transition-all",
  label: "text-xs font-black uppercase tracking-widest text-zinc-400 ml-4 mb-2",
};

interface StageConfigPanelProps {
  selectedContainer: EventContainer;
  selectedFlowId: string;
  selectedFlow: PromptFlow;
  handleUpdateContainer: (containerId: string, updates: Partial<EventContainer>) => void;
  setFlows: React.Dispatch<React.SetStateAction<Record<string, PromptFlow>>>;
  setSelectedContainerId: (id: string | null) => void;
}

export const StageConfigPanel: React.FC<StageConfigPanelProps> = ({
  selectedContainer,
  selectedFlowId,
  selectedFlow,
  handleUpdateContainer,
  setFlows,
  setSelectedContainerId
}) => {
  return (
    <div className="w-96 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <h3 className="font-black italic uppercase tracking-tighter">Stage Config</h3>
        <button 
          onClick={() => {
            const updatedContainers = { ...selectedFlow.containers };
            delete updatedContainers[selectedContainer.id];
            setFlows(prev => ({ ...prev, [selectedFlowId]: { ...selectedFlow, containers: updatedContainers } }));
            setSelectedContainerId(null);
          }} 
          className="text-red-500"
        ><Trash2 className="w-4 h-4" /></button>
      </div>
      
      <div className="space-y-8">
        <section className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className={STYLES.label}>Stage Name</label>
              <input className={STYLES.input} value={selectedContainer.name} onChange={(e) => handleUpdateContainer(selectedContainer.id, { name: e.target.value })}/>
            </div>
            <div className="flex flex-col gap-1">
              <label className={STYLES.label}>Next Stage ID</label>
              <input className={STYLES.input} value={selectedContainer.nextContainerId || ''} onChange={(e) => handleUpdateContainer(selectedContainer.id, { nextContainerId: e.target.value || undefined })} placeholder="End of Flow"/>
            </div>
            <div className="flex flex-col gap-1">
              <label className={STYLES.label} title="Fallback branching based on primary action">Legacy Branching (JSON)</label>
              <textarea 
                className={STYLES.input + " text-xs font-mono h-20 py-3"} 
                placeholder='{"Make": "success_stage", "Miss": "fail_stage"}'
                value={selectedContainer.branching ? JSON.stringify(selectedContainer.branching) : ''}
                onChange={(e) => {
                  try {
                    const val = e.target.value.trim();
                    const obj = val ? JSON.parse(val) : undefined;
                    handleUpdateContainer(selectedContainer.id, { branching: obj });
                  } catch (err) {}
                }}
              />
            </div>
        </section>

        <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-brand-orange">Advanced Rules</h4>
              <button 
                onClick={() => {
                  const newRule = { 
                    id: `rule_${Date.now()}`, 
                    conditionType: 'optionalField' as any, 
                    operator: 'equals' as any, 
                    value: '', 
                    nextContainerId: '' 
                  };
                  handleUpdateContainer(selectedContainer.id, { branchingRules: [...(selectedContainer.branchingRules || []), newRule] });
                }} 
                className="text-blue-500 text-xs font-black"
              >
                + ADD RULE
              </button>
            </div>
            <div className="space-y-4">
               {selectedContainer.branchingRules?.map((rule, i) => (
                 <div key={rule.id} className="p-4 bg-brand-orange/5 dark:bg-brand-orange/10 rounded-2xl border border-brand-orange/20 space-y-3 relative">
                    <button 
                      className="absolute top-2 right-2 p-1"
                      onClick={() => handleUpdateContainer(selectedContainer.id, { branchingRules: selectedContainer.branchingRules?.filter(r => r.id !== rule.id) })}
                    >
                      <X className="w-3 h-3 text-red-500"/>
                    </button>
                    
                    <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="text-xs font-black uppercase text-zinc-500">Check Type</label>
                         <select 
                           className="w-full bg-white dark:bg-zinc-950 text-xs p-2 rounded-lg mt-1" 
                           value={rule.conditionType} 
                           onChange={e => {
                             const next = [...(selectedContainer.branchingRules || [])];
                             next[i] = { ...rule, conditionType: e.target.value as any };
                             handleUpdateContainer(selectedContainer.id, { branchingRules: next });
                           }}
                         >
                            <option value="primaryChoice">Primary Action</option>
                            <option value="secondaryAction">Secondary Action</option>
                            <option value="optionalField">Optional Field</option>
                         </select>
                       </div>
                       
                       {(rule.conditionType === 'secondaryAction' || rule.conditionType === 'optionalField') && (
                         <div>
                           <label className="text-xs font-black uppercase text-zinc-500">Target ID</label>
                           <input 
                             className="w-full bg-white dark:bg-zinc-950 text-xs p-2 rounded-lg mt-1" 
                             placeholder="field_id / action_id"
                             value={rule.targetId || ''}
                             onChange={e => {
                               const next = [...(selectedContainer.branchingRules || [])];
                               next[i] = { ...rule, targetId: e.target.value };
                               handleUpdateContainer(selectedContainer.id, { branchingRules: next });
                             }}
                           />
                         </div>
                       )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                       <div>
                         <label className="text-xs font-black uppercase text-zinc-500">Operator</label>
                         <select 
                           className="w-full bg-white dark:bg-zinc-950 text-xs p-2 rounded-lg mt-1" 
                           value={rule.operator} 
                           onChange={e => {
                             const next = [...(selectedContainer.branchingRules || [])];
                             next[i] = { ...rule, operator: e.target.value as any };
                             handleUpdateContainer(selectedContainer.id, { branchingRules: next });
                           }}
                         >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Does Not Equal</option>
                            <option value="exists">Exists / Selected</option>
                            <option value="not_exists">Not Selected</option>
                         </select>
                       </div>
                       
                       {(rule.operator === 'equals' || rule.operator === 'not_equals') && (
                         <div>
                           <label className="text-xs font-black uppercase text-zinc-500">Value</label>
                           <input 
                             className="w-full bg-white dark:bg-zinc-950 text-xs p-2 rounded-lg mt-1" 
                             placeholder="E.g. Foul (Shooting)"
                             value={String(rule.value || '')}
                             onChange={e => {
                               const next = [...(selectedContainer.branchingRules || [])];
                               next[i] = { ...rule, value: e.target.value };
                               handleUpdateContainer(selectedContainer.id, { branchingRules: next });
                             }}
                           />
                         </div>
                       )}
                    </div>
                    
                    <div>
                        <label className="text-xs font-black uppercase text-brand-orange">Go To Stage ID</label>
                        <input 
                          className="w-full bg-white dark:bg-zinc-950 text-xs p-2 rounded-lg mt-1 border border-brand-orange/30 focus:border-brand-orange outline-none" 
                          placeholder="next_stage_id"
                          value={rule.nextContainerId}
                          onChange={e => {
                            const next = [...(selectedContainer.branchingRules || [])];
                            next[i] = { ...rule, nextContainerId: e.target.value };
                            handleUpdateContainer(selectedContainer.id, { branchingRules: next });
                          }}
                        />
                    </div>
                 </div>
               ))}
               {(!selectedContainer.branchingRules || selectedContainer.branchingRules.length === 0) && (
                 <div className="text-xs italic text-zinc-400">No advanced rules. Fallbacks to JSON or Next Stage ID.</div>
               )}
            </div>
        </section>

        <div className="h-[1px] bg-zinc-200 dark:bg-zinc-800" />

        <section className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-brand-orange">Primary Action</h4>
            <select className={STYLES.input + " text-xs uppercase"} value={selectedContainer.primaryAction.eventType} onChange={(e) => handleUpdateContainer(selectedContainer.id, { primaryAction: { ...selectedContainer.primaryAction, eventType: e.target.value as any } })}>
              {['shot', 'make', 'miss', 'to', 'foul', 'ast', 'oreb', 'dreb', 'blk', 'stl'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </section>

        <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 italic">Secondary Actions</h4>
              <button onClick={() => {
                const newAct: SecondaryAction = { id: `act_${Date.now()}`, label: 'Action', type: 'inline_actor_select', actorScope: 'OUR_TEAM', eventType: 'ast' as any };
                handleUpdateContainer(selectedContainer.id, { secondaryActions: [...selectedContainer.secondaryActions, newAct] });
              }} className="text-blue-500 text-xs font-black">+ ADD</button>
            </div>
            <div className="space-y-4">
              {selectedContainer.secondaryActions.map((action, i) => (
                <div key={action.id} className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-800 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <input className="bg-transparent font-black italic text-xs uppercase outline-none" value={action.label} onChange={(e) => {
                          const next = [...selectedContainer.secondaryActions];
                          next[i] = { ...action, label: e.target.value };
                          handleUpdateContainer(selectedContainer.id, { secondaryActions: next });
                      }}/>
                      <button onClick={() => handleUpdateContainer(selectedContainer.id, { secondaryActions: selectedContainer.secondaryActions.filter(a => a.id !== action.id) })}><X className="w-3 h-3 text-red-500"/></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <select className="bg-white dark:bg-zinc-800 text-xs p-2 rounded-lg" value={action.type} onChange={(e) => {
                        const next = [...selectedContainer.secondaryActions];
                        next[i] = { ...action, type: e.target.value as any };
                        handleUpdateContainer(selectedContainer.id, { secondaryActions: next });
                      }}>
                        <option value="inline_actor_select">Inline Select</option>
                        <option value="toggle_actor">Toggle</option>
                        <option value="required_actor">Required</option>
                      </select>
                      <select className="bg-white dark:bg-zinc-800 text-xs p-2 rounded-lg" value={action.eventType} onChange={(e) => {
                        const next = [...selectedContainer.secondaryActions];
                        next[i] = { ...action, eventType: e.target.value as any };
                        handleUpdateContainer(selectedContainer.id, { secondaryActions: next });
                      }}>
                        {['ast', 'stl', 'blk', 'foul', 'foul_drawn', 'oreb', 'dreb'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="mt-2">
                       <input 
                         className="w-full bg-white dark:bg-zinc-800 text-xs p-2 rounded-lg font-mono placeholder:text-zinc-500" 
                         placeholder="Condition e.g. selections.field_foul_during === 'No Foul'" 
                         value={action.condition || ''}
                         onChange={(e) => {
                           const next = [...selectedContainer.secondaryActions];
                           next[i] = { ...action, condition: e.target.value || undefined };
                           handleUpdateContainer(selectedContainer.id, { secondaryActions: next });
                         }}
                       />
                    </div>
                </div>
              ))}
            </div>
        </section>

        <section className="space-y-4 pb-20">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400 italic">Optional Context</h4>
              <button onClick={() => {
                  const newField: OptionalField = { id: `field_${Date.now()}`, label: 'Sub-Category', type: 'choice', visibleIn: ['detailed'], options: ['Option 1', 'Option 2'] };
                  handleUpdateContainer(selectedContainer.id, { optionalFields: [...selectedContainer.optionalFields, newField] });
              }} className="text-emerald-500 text-xs font-black">+ ADD</button>
            </div>
            <div className="space-y-4">
              {selectedContainer.optionalFields?.map((field, i) => (
                <div key={field.id} className="p-4 bg-emerald-50/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <input className="bg-transparent font-black italic text-xs uppercase text-emerald-600 dark:text-emerald-400 outline-none" value={field.label} onChange={(e) => {
                        const next = [...selectedContainer.optionalFields];
                        next[i] = { ...field, label: e.target.value };
                        handleUpdateContainer(selectedContainer.id, { optionalFields: next });
                      }}/>
                      <button onClick={() => handleUpdateContainer(selectedContainer.id, { optionalFields: selectedContainer.optionalFields.filter(f => f.id !== field.id) })}><X className="w-3 h-3 text-red-400"/></button>
                    </div>
                    <input className="w-full bg-white dark:bg-zinc-800 p-2 rounded-lg text-xs font-bold" value={field.options?.join(', ')} onChange={(e) => {
                        const next = [...selectedContainer.optionalFields];
                        next[i] = { ...field, options: e.target.value.split(',').map(s => s.trim()) };
                        handleUpdateContainer(selectedContainer.id, { optionalFields: next });
                    }} />
                </div>
              ))}
            </div>
        </section>
      </div>
    </div>
  );
};
