/**
 * Pure unit tests for bot permission bitfields defined in
 * `applications/bot/src/rest/permissions.ts`.
 *
 * No Effect layers needed — these are simple bitwise checks against Discord permission bigints.
 */

import { Discord } from 'dfx';
import { describe, expect, it } from 'vitest';
import {
  accessLevelPermission,
  CHANNEL_ACCESS_ADMIN,
  CHANNEL_ACCESS_EDIT,
  CHANNEL_ACCESS_VIEW,
} from '~/rest/permissions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const P = Discord.Permissions;

const hasBit = (value: bigint | undefined, bit: bigint) => ((value ?? 0n) & bit) === bit;

const missingBit = (value: bigint | undefined, bit: bigint) => ((value ?? 0n) & bit) === 0n;

// ---------------------------------------------------------------------------
// VIEW tier
// ---------------------------------------------------------------------------

describe('CHANNEL_ACCESS_VIEW', () => {
  it('allow has ViewChannel', () => {
    expect(hasBit(CHANNEL_ACCESS_VIEW.allow, P.ViewChannel)).toBe(true);
  });

  it('allow has ReadMessageHistory', () => {
    expect(hasBit(CHANNEL_ACCESS_VIEW.allow, P.ReadMessageHistory)).toBe(true);
  });

  it('allow does NOT have SendMessages', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.SendMessages)).toBe(true);
  });

  it('deny has SendMessages', () => {
    expect(hasBit(CHANNEL_ACCESS_VIEW.deny, P.SendMessages)).toBe(true);
  });

  // Critical safety invariants — no destructive channel permissions
  it('allow does NOT have ManageChannels', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.ManageChannels)).toBe(true);
  });

  it('allow does NOT have ManageRoles', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.ManageRoles)).toBe(true);
  });

  it('allow does NOT have Administrator', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.Administrator)).toBe(true);
  });

  it('allow does NOT have ManageWebhooks', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.ManageWebhooks)).toBe(true);
  });

  it('allow does NOT have ManageGuild', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.ManageGuild)).toBe(true);
  });

  it('allow does NOT have KickMembers', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.KickMembers)).toBe(true);
  });

  it('allow does NOT have BanMembers', () => {
    expect(missingBit(CHANNEL_ACCESS_VIEW.allow, P.BanMembers)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EDIT tier
// ---------------------------------------------------------------------------

describe('CHANNEL_ACCESS_EDIT', () => {
  it('allow has ViewChannel', () => {
    expect(hasBit(CHANNEL_ACCESS_EDIT.allow, P.ViewChannel)).toBe(true);
  });

  it('allow has ReadMessageHistory', () => {
    expect(hasBit(CHANNEL_ACCESS_EDIT.allow, P.ReadMessageHistory)).toBe(true);
  });

  it('allow has SendMessages', () => {
    expect(hasBit(CHANNEL_ACCESS_EDIT.allow, P.SendMessages)).toBe(true);
  });

  it('allow has AddReactions', () => {
    expect(hasBit(CHANNEL_ACCESS_EDIT.allow, P.AddReactions)).toBe(true);
  });

  it('allow has AttachFiles', () => {
    expect(hasBit(CHANNEL_ACCESS_EDIT.allow, P.AttachFiles)).toBe(true);
  });

  it('allow does NOT have ManageMessages', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.ManageMessages)).toBe(true);
  });

  it('allow does NOT have ManageThreads', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.ManageThreads)).toBe(true);
  });

  // Critical safety invariants
  it('allow does NOT have ManageChannels', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.ManageChannels)).toBe(true);
  });

  it('allow does NOT have ManageRoles', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.ManageRoles)).toBe(true);
  });

  it('allow does NOT have Administrator', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.Administrator)).toBe(true);
  });

  it('allow does NOT have ManageWebhooks', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.ManageWebhooks)).toBe(true);
  });

  it('allow does NOT have ManageGuild', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.ManageGuild)).toBe(true);
  });

  it('allow does NOT have KickMembers', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.KickMembers)).toBe(true);
  });

  it('allow does NOT have BanMembers', () => {
    expect(missingBit(CHANNEL_ACCESS_EDIT.allow, P.BanMembers)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ADMIN tier
// ---------------------------------------------------------------------------

describe('CHANNEL_ACCESS_ADMIN', () => {
  it('allow has ViewChannel', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.ViewChannel)).toBe(true);
  });

  it('allow has ReadMessageHistory', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.ReadMessageHistory)).toBe(true);
  });

  it('allow has SendMessages', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.SendMessages)).toBe(true);
  });

  it('allow has AddReactions', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.AddReactions)).toBe(true);
  });

  it('allow has AttachFiles', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.AttachFiles)).toBe(true);
  });

  it('allow has ManageMessages (ADMIN tier extra)', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.ManageMessages)).toBe(true);
  });

  it('allow has ManageThreads (ADMIN tier extra)', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.ManageThreads)).toBe(true);
  });

  it('allow has PinMessages (ADMIN tier extra)', () => {
    expect(hasBit(CHANNEL_ACCESS_ADMIN.allow, P.PinMessages)).toBe(true);
  });

  // Critical safety invariants — even ADMIN must not allow channel rename/delete
  it('allow does NOT have ManageChannels', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.ManageChannels)).toBe(true);
  });

  it('allow does NOT have ManageRoles', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.ManageRoles)).toBe(true);
  });

  it('allow does NOT have Administrator', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.Administrator)).toBe(true);
  });

  it('allow does NOT have ManageWebhooks', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.ManageWebhooks)).toBe(true);
  });

  it('allow does NOT have ManageGuild', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.ManageGuild)).toBe(true);
  });

  it('allow does NOT have KickMembers', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.KickMembers)).toBe(true);
  });

  it('allow does NOT have BanMembers', () => {
    expect(missingBit(CHANNEL_ACCESS_ADMIN.allow, P.BanMembers)).toBe(true);
  });

  // ADMIN is a strict superset of EDIT
  it('ADMIN allow is a superset of EDIT allow', () => {
    const editAllow = CHANNEL_ACCESS_EDIT.allow ?? 0n;
    const adminAllow = CHANNEL_ACCESS_ADMIN.allow ?? 0n;
    expect((adminAllow & editAllow) === editAllow).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// accessLevelPermission dispatcher
// ---------------------------------------------------------------------------

describe('accessLevelPermission', () => {
  it("accessLevelPermission('VIEW') returns CHANNEL_ACCESS_VIEW", () => {
    expect(accessLevelPermission('VIEW')).toBe(CHANNEL_ACCESS_VIEW);
  });

  it("accessLevelPermission('EDIT') returns CHANNEL_ACCESS_EDIT", () => {
    expect(accessLevelPermission('EDIT')).toBe(CHANNEL_ACCESS_EDIT);
  });

  it("accessLevelPermission('ADMIN') returns CHANNEL_ACCESS_ADMIN", () => {
    expect(accessLevelPermission('ADMIN')).toBe(CHANNEL_ACCESS_ADMIN);
  });
});
