/**
 * Synthetic mock data fixtures for AqOne & Dev Guild Manager MVP
 * Conforms strictly to PROD-003 DATA_MODEL.md
 */

export const FIXTURE_ORGS = [
  { id: 'org-1', name: 'AqOne', status: 'active' },
  { id: 'org-2', name: 'Dev Guild', status: 'active' }
];

export const FIXTURE_USERS = {
  len: {
    id: 'usr-owner',
    email: 'len@example.com',
    displayName: 'Len',
    avatarColor: '#0F766E',
    status: 'active',
    isGlobalOwner: true,
    skills: ['Architecture', 'Leadership'],
    interests: ['Product Strategy', 'Systems Design'],
    memberships: [
      { orgId: 'org-1', role: 'Owner', status: 'active', notes: 'Founder and Global Owner' },
      { orgId: 'org-2', role: 'Owner', status: 'active', notes: 'Founder and Global Owner' }
    ]
  },
  alex: {
    id: 'usr-alex',
    email: 'alex@example.com',
    displayName: 'Alex Rivera',
    avatarColor: '#2563EB',
    status: 'active',
    isGlobalOwner: false,
    skills: ['Frontend', 'UI Design', 'Flutter'],
    interests: ['Accessibility', 'Mobile'],
    memberships: [
      { orgId: 'org-1', role: 'Lead', status: 'active', notes: 'Frontend lead for AqOne projects' },
      { orgId: 'org-2', role: 'Member', status: 'active', notes: 'Regular contributor to dev tools' }
    ]
  },
  sam: {
    id: 'usr-sam',
    email: 'sam@example.com',
    displayName: 'Sam Taylor',
    avatarColor: '#7C3AED',
    status: 'active',
    isGlobalOwner: false,
    skills: ['Node.js', 'PostgreSQL', 'Testing'],
    interests: ['Backend Systems', 'Performance'],
    memberships: [
      { orgId: 'org-1', role: 'Member', status: 'active', notes: 'Backend apprentice in AqOne' },
      { orgId: 'org-2', role: 'Member', status: 'active', notes: 'Core developer in Dev Guild' }
    ]
  },
  jordan: {
    id: 'usr-jordan',
    email: 'jordan@example.com',
    displayName: 'Jordan Lee',
    avatarColor: '#EA580C',
    status: 'active',
    isGlobalOwner: false,
    skills: ['DevOps', 'CI/CD', 'Security'],
    interests: ['Automation', 'Infrastructure'],
    memberships: [
      { orgId: 'org-2', role: 'Lead', status: 'active', notes: 'Dev Guild lead engineer' }
    ]
  }
};

export function createInitialState() {
  return {
    currentUser: FIXTURE_USERS.len,
    currentScope: 'all', // 'all', 'org-1', 'org-2'
    organizations: JSON.parse(JSON.stringify(FIXTURE_ORGS)),
    members: [
      {
        id: 'mem-1',
        userId: 'usr-owner',
        orgId: 'org-1',
        displayName: 'Len',
        email: 'len@example.com',
        avatarColor: '#0F766E',
        role: 'Owner',
        status: 'active',
        joinedAt: '2026-08-01T08:00:00+08:00',
        skills: ['Architecture', 'Leadership'],
        interests: ['Product Strategy'],
        notes: 'Global owner - manages all organizations.'
      },
      {
        id: 'mem-2',
        userId: 'usr-owner',
        orgId: 'org-2',
        displayName: 'Len',
        email: 'len@example.com',
        avatarColor: '#0F766E',
        role: 'Owner',
        status: 'active',
        joinedAt: '2026-08-01T08:00:00+08:00',
        skills: ['Architecture', 'Leadership'],
        interests: ['Product Strategy'],
        notes: 'Global owner.'
      },
      {
        id: 'mem-3',
        userId: 'usr-alex',
        orgId: 'org-1',
        displayName: 'Alex Rivera',
        email: 'alex@example.com',
        avatarColor: '#2563EB',
        role: 'Lead',
        status: 'active',
        joinedAt: '2026-08-05T09:30:00+08:00',
        skills: ['Frontend', 'UI Design', 'Flutter'],
        interests: ['Accessibility', 'Mobile'],
        notes: 'AqOne team technical lead.'
      },
      {
        id: 'mem-4',
        userId: 'usr-alex',
        orgId: 'org-2',
        displayName: 'Alex Rivera',
        email: 'alex@example.com',
        avatarColor: '#2563EB',
        role: 'Member',
        status: 'active',
        joinedAt: '2026-08-06T10:15:00+08:00',
        skills: ['Frontend'],
        interests: ['Design Systems'],
        notes: 'Guild member collaborating on UI components.'
      },
      {
        id: 'mem-5',
        userId: 'usr-sam',
        orgId: 'org-1',
        displayName: 'Sam Taylor',
        email: 'sam@example.com',
        avatarColor: '#7C3AED',
        role: 'Member',
        status: 'active',
        joinedAt: '2026-08-10T14:00:00+08:00',
        skills: ['Node.js', 'PostgreSQL'],
        interests: ['Backend Systems'],
        notes: 'Works on REST API development.'
      },
      {
        id: 'mem-6',
        userId: 'usr-sam',
        orgId: 'org-2',
        displayName: 'Sam Taylor',
        email: 'sam@example.com',
        avatarColor: '#7C3AED',
        role: 'Member',
        status: 'active',
        joinedAt: '2026-08-11T11:00:00+08:00',
        skills: ['Node.js', 'Testing'],
        interests: ['Automation'],
        notes: 'Helps maintain build scripts.'
      },
      {
        id: 'mem-7',
        userId: 'usr-jordan',
        orgId: 'org-2',
        displayName: 'Jordan Lee',
        email: 'jordan@example.com',
        avatarColor: '#EA580C',
        role: 'Lead',
        status: 'active',
        joinedAt: '2026-08-02T13:00:00+08:00',
        skills: ['DevOps', 'CI/CD'],
        interests: ['Infrastructure'],
        notes: 'Dev Guild lead organizer.'
      }
    ],
    invitations: [
      {
        id: 'inv-1',
        email: 'pat@example.com',
        orgId: 'org-1',
        role: 'Member',
        status: 'pending',
        expiresAt: '2026-09-20T23:59:59+08:00'
      }
    ],
    tasks: [
      {
        id: 'tsk-101',
        orgId: 'org-1',
        title: 'Design responsive navigation rail',
        description: 'Implement responsive drawer behavior for screens under 768px with full keyboard access.',
        creator: 'usr-owner',
        creatorName: 'Len',
        assignee: 'usr-alex',
        assigneeName: 'Alex Rivera',
        status: 'In progress',
        priority: 'High',
        dueDate: '2026-09-25',
        labels: ['frontend', 'ui', 'accessibility'],
        archived: false,
        updatedAt: '2026-09-16T12:00:00+08:00',
        comments: [
          {
            id: 'cmt-1',
            authorId: 'usr-owner',
            authorName: 'Len',
            body: 'Make sure 48px touch targets are preserved on mobile.',
            createdAt: '2026-09-16T13:00:00+08:00'
          }
        ]
      },
      {
        id: 'tsk-102',
        orgId: 'org-1',
        title: 'Audit color contrast ratios for light mode',
        description: 'Verify WCAG 2.2 AA contrast compliance across buttons, links, and badges.',
        creator: 'usr-alex',
        creatorName: 'Alex Rivera',
        assignee: 'usr-alex',
        assigneeName: 'Alex Rivera',
        status: 'Done',
        priority: 'Medium',
        dueDate: '2026-09-15', // Overdue relative to 2026-09-16, but status is Done so not in overdue count
        labels: ['a11y', 'design'],
        archived: false,
        updatedAt: '2026-09-15T18:00:00+08:00',
        comments: []
      },
      {
        id: 'tsk-103',
        orgId: 'org-1',
        title: 'Review database indexes for membership queries',
        description: 'Ensure composite unique index on user_id and organization_id is properly utilized.',
        creator: 'usr-owner',
        creatorName: 'Len',
        assignee: 'usr-sam',
        assigneeName: 'Sam Taylor',
        status: 'Backlog',
        priority: 'Low',
        dueDate: '2026-09-12', // Past date and open -> OVERDUE
        labels: ['database', 'performance'],
        archived: false,
        updatedAt: '2026-09-14T09:00:00+08:00',
        comments: []
      },
      {
        id: 'tsk-201',
        orgId: 'org-2',
        title: 'Setup automated linting and formatting pipeline',
        description: 'Standardize linter rules and commit verification scripts for guild projects.',
        creator: 'usr-jordan',
        creatorName: 'Jordan Lee',
        assignee: 'usr-sam',
        assigneeName: 'Sam Taylor',
        status: 'In progress',
        priority: 'High',
        dueDate: '2026-09-14', // Past date and open -> OVERDUE
        labels: ['tooling', 'devops'],
        archived: false,
        updatedAt: '2026-09-14T15:00:00+08:00',
        comments: []
      },
      {
        id: 'tsk-202',
        orgId: 'org-2',
        title: 'Prepare workshop on Flutter widget architecture',
        description: 'Draft slides and code examples on widget tree optimization and state isolation.',
        creator: 'usr-jordan',
        creatorName: 'Jordan Lee',
        assignee: 'usr-alex',
        assigneeName: 'Alex Rivera',
        status: 'Blocked',
        priority: 'Medium',
        dueDate: '2026-09-30',
        labels: ['workshop', 'mobile'],
        archived: false,
        updatedAt: '2026-09-16T10:00:00+08:00',
        comments: [
          {
            id: 'cmt-2',
            authorId: 'usr-alex',
            authorName: 'Alex Rivera',
            body: 'Waiting for sample repository review before finalizing slide examples.',
            createdAt: '2026-09-16T11:00:00+08:00'
          }
        ]
      }
    ],
    announcements: [
      {
        id: 'ann-1',
        title: 'Welcome to the AqOne & Dev Guild unified management portal',
        body: 'We have launched the new consolidated management hub. Leads and members can view projects, track tasks, and stay aligned across organizations.',
        authorId: 'usr-owner',
        authorName: 'Len',
        targetOrgs: ['org-1', 'org-2'],
        status: 'published',
        publishedAt: '2026-09-15T09:00:00+08:00',
        archived: false
      },
      {
        id: 'ann-2',
        title: 'AqOne Q3 Sprint Kickoff',
        body: 'AqOne sprint goals have been updated. Please inspect your assigned tasks and update status accordingly.',
        authorId: 'usr-alex',
        authorName: 'Alex Rivera',
        targetOrgs: ['org-1'],
        status: 'published',
        publishedAt: '2026-09-16T08:30:00+08:00',
        archived: false
      },
      {
        id: 'ann-3',
        title: 'Dev Guild tooling roadmap (Draft)',
        body: 'Draft proposal for upcoming tooling upgrades and code sharing initiatives across guild repositories.',
        authorId: 'usr-jordan',
        authorName: 'Jordan Lee',
        targetOrgs: ['org-2'],
        status: 'draft',
        publishedAt: null,
        archived: false
      }
    ],
    activities: [
      {
        id: 'act-1',
        orgId: 'org-1',
        actorName: 'Len',
        action: 'Created task "Design responsive navigation rail"',
        timestamp: '2026-09-16T11:50:00+08:00'
      },
      {
        id: 'act-2',
        orgId: 'org-1',
        actorName: 'Alex Rivera',
        action: 'Completed task "Audit color contrast ratios for light mode"',
        timestamp: '2026-09-15T18:00:00+08:00'
      },
      {
        id: 'act-3',
        orgId: 'org-2',
        actorName: 'Jordan Lee',
        action: 'Assigned task "Setup automated linting" to Sam Taylor',
        timestamp: '2026-09-14T15:00:00+08:00'
      }
    ]
  };
}
