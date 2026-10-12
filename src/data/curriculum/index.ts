import type { Lesson } from '../types';
import { weeks01to02 } from './weeks01-02';
import { weeks03to04 } from './weeks03-04';
import { weeks05to08 } from './weeks05-08';
import { weeks09to12 } from './weeks09-12';
import { weeks13to19 } from './weeks13-19';
import { weeks20to26 } from './weeks20-26';
import { weeks27to33 } from './weeks27-33';
import { weeks34to39 } from './weeks34-39';
import { weeks40to45 } from './weeks40-45';
import { weeks46to52 } from './weeks46-52';

/** The full 52-week curriculum, sorted by week. */
export const CURRICULUM: readonly Lesson[] = [
  ...weeks01to02,
  ...weeks03to04,
  ...weeks05to08,
  ...weeks09to12,
  ...weeks13to19,
  ...weeks20to26,
  ...weeks27to33,
  ...weeks34to39,
  ...weeks40to45,
  ...weeks46to52,
].sort((a, b) => a.week - b.week);
