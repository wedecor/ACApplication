export interface RbacSyncStats {
  permissionsUpserted: number;
  permissionsDeprecated: number;
  rolesSynced: number;
  roleAssignmentsAdded: number;
  roleAssignmentsRemoved: number;
  rbacVersionBumped: boolean;
}

export interface RbacConsistencyReport {
  inSync: boolean;
  registryPermissionCount: number;
  dbPermissionCount: number;
  missingInDb: string[];
  orphanInDb: string[];
  duplicateInDb: string[];
  staleRoles: Array<{
    roleKey: string;
    tenantId: string;
    missingAssignments: string[];
    extraAssignments: string[];
  }>;
  rbacVersionByTenant: Array<{ tenantId: string; slug: string; rbacVersion: number }>;
}

export interface RbacHealthReport extends RbacConsistencyReport {
  syncStatus: 'ok' | 'drift_detected';
  registryValid: boolean;
  registryIssues: string[];
  checkedAt: string;
}
