import type { Instant } from "../domain/types.js";

export interface Clock {
  nowInstant(): Instant;
}

export class SystemClock implements Clock {
  nowInstant(): Instant {
    return new Date().toISOString() as Instant;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly instant: Instant) {}
  nowInstant(): Instant {
    return this.instant;
  }
}
