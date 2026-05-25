// Tests for buildTeamChallengeEmbed — embed layout, colors, i18n, and deep-link behavior.

import type { Team, TeamChallenge } from '@sideline/domain';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { buildTeamChallengeEmbed } from '~/rest/teamChallenge/buildTeamChallengeEmbed.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEAM_ID = '00000000-0000-0000-0000-000000000010' as Team.TeamId;
const CHALLENGE_TITLE = 'Hoď co nejdál' as TeamChallenge.TeamChallengeTitle;
const START_DATE = '2026-03-09';
const END_DATE = '2026-03-15';

// ---------------------------------------------------------------------------
// Base fixture
// ---------------------------------------------------------------------------

const baseInput = {
  title: CHALLENGE_TITLE,
  kind: 'throwing' as const,
  description: Option.none<string>(),
  startDate: START_DATE,
  endDate: END_DATE,
  teamId: TEAM_ID,
  webUrl: Option.none<string>(),
  locale: 'cs' as const,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildTeamChallengeEmbed', () => {
  it('kind=throwing → title starts with 🥏 prefix', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'throwing' });

    expect(embed.title).toBeDefined();
    expect(embed.title?.startsWith('🥏 ')).toBe(true);
  });

  it('kind=sport → title starts with 🏃 prefix', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'sport' });

    expect(embed.title).toBeDefined();
    expect(embed.title?.startsWith('🏃 ')).toBe(true);
  });

  it('kind=throwing → color is 0x10b981 (throwing green)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'throwing' });

    expect(embed.color).toBe(0x10b981);
  });

  it('kind=sport → color is 0xf59e0b (sport amber)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'sport' });

    expect(embed.color).toBe(0xf59e0b);
  });

  it('title includes the challenge title verbatim after the kind prefix', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, title: CHALLENGE_TITLE });

    expect(embed.title).toContain(CHALLENGE_TITLE);
  });

  it('field kind label shows Czech kind for cs locale — throwing (exact field name + value)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'throwing', locale: 'cs' });

    const fields = embed.fields ?? [];
    const kindField = fields.find((f: { name: string; value: string }) => f.name === 'Druh');
    expect(kindField).toBeDefined();
    expect(kindField?.value).toBe('🥏 Házecí');
  });

  it('field kind label shows Czech kind for cs locale — sport (exact field name + value)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'sport', locale: 'cs' });

    const fields = embed.fields ?? [];
    const kindField = fields.find((f: { name: string; value: string }) => f.name === 'Druh');
    expect(kindField).toBeDefined();
    expect(kindField?.value).toBe('🏃 Sportovní');
  });

  it('field kind label shows English kind for en locale — throwing (exact field name + value)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'throwing', locale: 'en' });

    const fields = embed.fields ?? [];
    const kindField = fields.find((f: { name: string; value: string }) => f.name === 'Kind');
    expect(kindField).toBeDefined();
    expect(kindField?.value).toBe('🥏 Throwing');
    // Must not contain Czech label
    const czKindField = fields.find((f: { name: string; value: string }) =>
      f.value.includes('Házecí'),
    );
    expect(czKindField).toBeUndefined();
  });

  it('field kind label shows English kind for en locale — sport (exact field name + value)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, kind: 'sport', locale: 'en' });

    const fields = embed.fields ?? [];
    const kindField = fields.find((f: { name: string; value: string }) => f.name === 'Kind');
    expect(kindField).toBeDefined();
    expect(kindField?.value).toBe('🏃 Sport');
  });

  it('period field contains start and end dates', () => {
    const embed = buildTeamChallengeEmbed({
      ...baseInput,
      startDate: START_DATE,
      endDate: END_DATE,
    });

    const fields = embed.fields ?? [];
    // There must be a field whose value contains both start and end dates
    const periodField = fields.find(
      (f: { name: string; value: string }) =>
        f.value.includes(START_DATE) && f.value.includes(END_DATE),
    );
    expect(periodField).toBeDefined();
    // The dates should be separated by a dash (–)
    expect(periodField?.value).toMatch(/–|-/);
  });

  it('description=Option.none() → exactly 2 fields: Druh and Období (cs locale)', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, description: Option.none() });

    const fields = embed.fields ?? [];
    expect(fields).toHaveLength(2);
    const fieldNames = fields
      .map((f: { name: string; value: string }) => f.name)
      .sort() as string[];
    expect(fieldNames).toEqual(['Druh', 'Období'].sort());
  });

  it('description=Option.some("foo") → 3 fields, description field value equals "foo"', () => {
    const DESCRIPTION = 'Hoď frisbee co nejdál, výhra patří nejlepšímu!';
    const embed = buildTeamChallengeEmbed({
      ...baseInput,
      description: Option.some(DESCRIPTION),
    });

    const fields = embed.fields ?? [];
    expect(fields).toHaveLength(3);
    const descField = fields.find((f: { name: string; value: string }) => f.value === DESCRIPTION);
    expect(descField).toBeDefined();
    // The description field name should equal the challenge title (as per plan §5.4)
    expect(descField?.name).toBe(CHALLENGE_TITLE);
  });

  it('webUrl=Option.some with trailing slash → embed.url strips trailing slash and appends /teams/{teamId}/challenges', () => {
    const embed = buildTeamChallengeEmbed({
      ...baseInput,
      webUrl: Option.some('https://app.example.com/'),
    });

    expect(embed.url).toBeDefined();
    // Trailing slash must be stripped, path appended
    expect(embed.url).toBe(`https://app.example.com/teams/${TEAM_ID}/challenges`);
  });

  it('webUrl=Option.some without trailing slash → embed.url appends /teams/{teamId}/challenges', () => {
    const embed = buildTeamChallengeEmbed({
      ...baseInput,
      webUrl: Option.some('https://app.example.com'),
    });

    expect(embed.url).toBeDefined();
    expect(embed.url).toBe(`https://app.example.com/teams/${TEAM_ID}/challenges`);
  });

  it('webUrl=Option.none() → embed.url is undefined', () => {
    const embed = buildTeamChallengeEmbed({ ...baseInput, webUrl: Option.none() });

    expect(embed.url).toBeUndefined();
  });

  it('footer text is the Czech i18n footer value for cs locale', () => {
    // cs.json: "teamChallenge_embed_footer": "Sideline · Výzva"
    const embed = buildTeamChallengeEmbed({ ...baseInput, locale: 'cs' });

    expect(embed.footer).toBeDefined();
    expect(embed.footer?.text).toBe('Sideline · Výzva');
  });
});
