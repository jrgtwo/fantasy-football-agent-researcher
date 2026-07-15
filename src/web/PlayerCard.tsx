import type { ReactNode } from 'react';
import type { Player, PlayerStats } from '../data/types';

// The shared player stat card — headshot, identity, and a compact stat line — rendered from our own
// nflverse data. Used by the Evaluate tab (with an action button via children) and hydrated into the
// Rankings board from the ranker's [[Pn]] handles.
export function PlayerCard({
  player,
  stats,
  className = '',
  children,
}: {
  player: Player;
  stats: PlayerStats;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`card ${className}`.trim()}>
      {player.headshot && <img src={player.headshot} alt="" width={72} height={72} />}
      <div className="card-body">
        <h2>{player.name}</h2>
        <p className="muted">
          {player.position} · {player.team} · {stats.games} G
        </p>
        <ul className="statline">
          <li>
            <b>{stats.fantasyPointsPpr.toFixed(1)}</b> PPR
          </li>
          {stats.passingYards > 0 && (
            <li>
              {stats.passingYards} pass yds · {stats.passingTds} TD
            </li>
          )}
          {stats.rushingYards > 0 && (
            <li>
              {stats.rushingYards} rush yds · {stats.rushingTds} TD
            </li>
          )}
          {stats.receivingYards > 0 && (
            <li>
              {stats.receptions} rec · {stats.receivingYards} yds · {stats.receivingTds} TD
            </li>
          )}
        </ul>
      </div>
      {children}
    </section>
  );
}
