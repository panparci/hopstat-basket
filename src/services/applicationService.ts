import { initDB } from '../lib/db';
import { RoleApplication } from '../core/types/roleApplication';
import { authService } from './authService';

export const applicationService = {
  async createApplication(
    userId: string,
    userName: string,
    userEmail: string,
    requestedRole: 'statistician' | 'scout' | 'coach',
    motivation: string,
    experience?: string
  ): Promise<RoleApplication> {
    try {
      const db = await initDB();
      
      // Safety check: is there already a pending application for this user?
      const allApps = await db.getAllFromIndex('role_applications', 'by-user', userId);
      const hasPending = allApps.some(app => app.status === 'pending');
      if (hasPending) {
        throw new Error('Anda sudah memiliki pengajuan yang sedang diproses!');
      }

      const id = 'app_' + Math.random().toString(36).substring(2, 11);
      const newApp: RoleApplication = {
        id,
        userId,
        userName,
        userEmail,
        requestedRole,
        motivation,
        experience: experience || '',
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.put('role_applications', newApp);
      return newApp;
    } catch (error) {
      console.error('Error creating role application:', error);
      throw error;
    }
  },

  async getApplications(status?: 'pending' | 'approved' | 'rejected'): Promise<RoleApplication[]> {
    try {
      const db = await initDB();
      if (status) {
        return await db.getAllFromIndex('role_applications', 'by-status', status);
      }
      return await db.getAll('role_applications');
    } catch (error) {
      console.error('Error getting role applications:', error);
      throw error;
    }
  },

  async getUserApplications(userId: string): Promise<RoleApplication[]> {
    try {
      const db = await initDB();
      return await db.getAllFromIndex('role_applications', 'by-user', userId);
    } catch (error) {
      console.error('Error getting user applications:', error);
      throw error;
    }
  },

  async reviewApplication(
    id: string,
    decision: 'approved' | 'rejected',
    note: string,
    reviewerId: string
  ): Promise<RoleApplication> {
    try {
      const db = await initDB();
      const app = await db.get('role_applications', id);
      if (!app) {
        throw new Error('Pengajuan tidak ditemukan');
      }

      if (app.status !== 'pending') {
        throw new Error('Pengajuan ini sudah ditinjau');
      }

      app.status = decision;
      app.reviewNote = note;
      app.reviewedBy = reviewerId;
      app.updatedAt = Date.now();

      if (decision === 'approved') {
        // Panggil authService.updateUserRole(userId, requestedRole)
        await authService.updateUserRole(app.userId, app.requestedRole);
      }

      await db.put('role_applications', app);
      return app;
    } catch (error) {
      console.error('Error reviewing application:', error);
      throw error;
    }
  }
};
