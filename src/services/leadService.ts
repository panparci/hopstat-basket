import { initDB } from '../lib/db';
import { Lead, LeadNote } from '../core/types/crm';

export const leadService = {
  async createLead(data: {
    name: string;
    email: string;
    phone?: string;
    childAge?: string;
    source: Lead['source'];
    interest: Lead['interest'];
  }): Promise<Lead> {
    try {
      const db = await initDB();
      const id = crypto.randomUUID();
      const newLead: Lead = {
        id,
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        childAge: data.childAge || '',
        source: data.source,
        interest: data.interest,
        stage: 'new',
        notes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await db.put('leads', newLead);
      return newLead;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  },

  async getLeads(): Promise<Lead[]> {
    try {
      const db = await initDB();
      const leads = await db.getAll('leads');
      return leads.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error getting leads:', error);
      return [];
    }
  },

  async updateLeadStage(id: string, stage: Lead['stage']): Promise<Lead | null> {
    try {
      const db = await initDB();
      const lead = await db.get('leads', id);
      if (!lead) return null;

      const updatedLead: Lead = {
        ...lead,
        stage,
        updatedAt: Date.now()
      };
      await db.put('leads', updatedLead);
      return updatedLead;
    } catch (error) {
      console.error('Error updating lead stage:', error);
      throw error;
    }
  },

  async addLeadNote(leadId: string, text: string): Promise<Lead | null> {
    try {
      const db = await initDB();
      const lead = await db.get('leads', leadId);
      if (!lead) return null;

      const newNote: LeadNote = {
        id: crypto.randomUUID(),
        text,
        createdAt: Date.now()
      };

      const updatedLead: Lead = {
        ...lead,
        notes: [newNote, ...lead.notes], // Add note at the beginning
        updatedAt: Date.now()
      };
      await db.put('leads', updatedLead);
      return updatedLead;
    } catch (error) {
      console.error('Error adding lead note:', error);
      throw error;
    }
  },

  async deleteLead(id: string): Promise<void> {
    try {
      const db = await initDB();
      await db.delete('leads', id);
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  }
};
