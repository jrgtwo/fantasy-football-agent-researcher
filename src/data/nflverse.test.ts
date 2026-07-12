import { describe, expect, it } from 'vitest';
import { parsePlayersCsv, parseStatsCsv } from './nflverse';

// Fixtures mirror the real nflverse headers (subset of columns), including a quoted headshot URL
// that contains a comma — which a naive split(',') would break on.
const PLAYERS_CSV = `gsis_id,display_name,position,latest_team,headshot,status
00-0038389,Israel Abanikanda,RB,DAL,"https://x/f_auto,q_auto/img.png",ACT
00-0000001,Test Kicker,K,KC,,INA`;

const STATS_CSV = `player_id,player_display_name,position,recent_team,season,season_type,games,passing_yards,passing_tds,passing_interceptions,carries,rushing_yards,rushing_tds,receptions,targets,receiving_yards,receiving_tds,fantasy_points,fantasy_points_ppr
00-0038389,Israel Abanikanda,RB,DAL,2025,REG,10,0,0,0,45,210,2,12,15,90,1,45.5,57.5`;

describe('parsePlayersCsv', () => {
  it('maps columns by name into Player records', () => {
    const players = parsePlayersCsv(PLAYERS_CSV);
    expect(players).toHaveLength(2);
    expect(players[0]).toEqual({
      id: '00-0038389',
      name: 'Israel Abanikanda',
      position: 'RB',
      team: 'DAL',
      headshot: 'https://x/f_auto,q_auto/img.png',
      status: 'ACT',
    });
  });

  it('keeps empty fields as empty strings (no headshot)', () => {
    const players = parsePlayersCsv(PLAYERS_CSV);
    expect(players[1]?.headshot).toBe('');
  });
});

describe('parseStatsCsv', () => {
  it('maps a stats row, coercing numeric columns to numbers', () => {
    const stats = parseStatsCsv(STATS_CSV);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toEqual({
      playerId: '00-0038389',
      season: 2025,
      seasonType: 'REG',
      team: 'DAL',
      games: 10,
      passingYards: 0,
      passingTds: 0,
      interceptions: 0,
      carries: 45,
      rushingYards: 210,
      rushingTds: 2,
      receptions: 12,
      targets: 15,
      receivingYards: 90,
      receivingTds: 1,
      fantasyPoints: 45.5,
      fantasyPointsPpr: 57.5,
    });
  });
});
