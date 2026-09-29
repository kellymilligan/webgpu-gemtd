/**
 * The valley layout. Creeps enter at the first waypoint and must visit each
 * in order, leaving at the last (the Heart).
 */
export const GRID_W = 31;
export const GRID_H = 31;

export interface Waypoint {
  x: number;
  y: number;
  name: string;
}

export const WAYPOINTS: readonly Waypoint[] = [
  { x: 2, y: 2, name: 'Rift' },
  { x: 2, y: 15, name: 'West Stone' },
  { x: 15, y: 15, name: 'Centre Stone' },
  { x: 15, y: 2, name: 'North Stone' },
  { x: 28, y: 2, name: 'East Stone' },
  { x: 28, y: 28, name: 'South Stone' },
  { x: 2, y: 28, name: 'Heart' },
];
