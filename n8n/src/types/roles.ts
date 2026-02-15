/**
 * Membership Role Types
 *
 * Hierarchical role system for organization members.
 * Roles determine permissions and access levels within the organization.
 */

export type MembershipRole =
  | 'owner'            // Full organization access - can do everything
  | 'admin'            // Administrative access - similar to owner but cannot delete org
  | 'bu_manager'       // Business Unit Manager - manage projects, teams within BU
  | 'hod'              // Head of Department - manage department projects and team members
  | 'team_lead'        // Team Lead - manage team tasks and projects
  | 'pmo'              // PMO/HR/Finance - read-only access for reporting
  | 'member'           // Individual Contributor - basic work permissions
  | 'guest'            // Guest/Partner - read-only access to shared resources

/**
 * Legacy role type for backward compatibility
 * @deprecated Use MembershipRole instead
 */
export type UserRole = 'admin' | 'manager' | 'member' | 'guest'

/**
 * Role display names for UI
 */
export const RoleLabels: Record<MembershipRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  bu_manager: 'Business Unit Manager',
  hod: 'Head of Department',
  team_lead: 'Team Lead',
  pmo: 'PMO/HR/Finance',
  member: 'Member',
  guest: 'Guest',
}

/**
 * Role descriptions for UI tooltips
 */
export const RoleDescriptions: Record<MembershipRole, string> = {
  owner: 'Full organizational access - can do everything including deleting the organization',
  admin: 'Administrative access - can manage users, projects, and settings but cannot delete organization',
  bu_manager: 'Manage projects, teams, and resources within their Business Unit',
  hod: 'Manage department projects, team members, and departmental OKRs/KPIs',
  team_lead: 'Manage team tasks, projects, and team members',
  pmo: 'Read-only access across the organization for reporting and analytics',
  member: 'Basic work permissions - can create and update own tasks, view projects',
  guest: 'Read-only access to shared resources - typically for external partners',
}

/**
 * Role hierarchy levels (higher number = more privileges)
 */
export const RoleHierarchy: Record<MembershipRole, number> = {
  owner: 100,
  admin: 90,
  bu_manager: 70,
  hod: 60,
  team_lead: 50,
  pmo: 40,
  member: 20,
  guest: 10,
}

/**
 * Management roles that can assign tasks and manage team members
 */
export const ManagementRoles: MembershipRole[] = [
  'owner',
  'admin',
  'bu_manager',
  'hod',
  'team_lead',
]

/**
 * Privileged roles with full organizational access
 */
export const PrivilegedRoles: MembershipRole[] = ['owner', 'admin']

/**
 * Scoped roles with limited access to specific organizational units
 */
export const ScopedRoles: MembershipRole[] = ['bu_manager', 'hod', 'team_lead', 'pmo']

/**
 * Read-only roles
 */
export const ReadOnlyRoles: MembershipRole[] = ['pmo', 'guest']

/**
 * Check if a role has management capabilities
 */
export function isManagementRole(role: MembershipRole): boolean {
  return ManagementRoles.includes(role)
}

/**
 * Check if a role has privileged (full org) access
 */
export function isPrivilegedRole(role: MembershipRole): boolean {
  return PrivilegedRoles.includes(role)
}

/**
 * Check if a role has scoped access
 */
export function isScopedRole(role: MembershipRole): boolean {
  return ScopedRoles.includes(role)
}

/**
 * Check if a role is read-only
 */
export function isReadOnlyRole(role: MembershipRole): boolean {
  return ReadOnlyRoles.includes(role)
}

/**
 * Check if role A has higher privileges than role B
 */
export function hasHigherPrivileges(roleA: MembershipRole, roleB: MembershipRole): boolean {
  return RoleHierarchy[roleA] > RoleHierarchy[roleB]
}

/**
 * Get roles that can be assigned by a given role
 * Users can only assign roles with equal or lower privileges
 */
export function getAssignableRoles(currentRole: MembershipRole): MembershipRole[] {
  const currentLevel = RoleHierarchy[currentRole]
  return (Object.keys(RoleHierarchy) as MembershipRole[]).filter(
    (role) => RoleHierarchy[role] <= currentLevel && role !== 'owner'
  )
}
