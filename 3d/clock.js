// Đồng hồ trong game: 20 giây thật = 1 phút trong game.
export const REAL_SECONDS_PER_GAME_MINUTE = 20;
const DAY = 1440;

export class GameClock {
  constructor(totalMinutes = 21 * 60) {
    this.totalMinutes = totalMinutes; // tính từ 00:00 ngày 1
    this.speed = 1;
  }

  update(realSeconds) {
    this.totalMinutes += (realSeconds / REAL_SECONDS_PER_GAME_MINUTE) * this.speed;
  }

  get day() { return Math.floor(this.totalMinutes / DAY) + 1; }
  get minuteOfDay() { return ((this.totalMinutes % DAY) + DAY) % DAY; }

  get label() {
    const m = Math.floor(this.minuteOfDay);
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  // Tua tới lần kế tiếp đồng hồ chỉ `targetMinute` (phút trong ngày).
  advanceTo(targetMinute) {
    let delta = targetMinute - this.minuteOfDay;
    if (delta <= 0) delta += DAY;
    this.totalMinutes += delta;
  }

  advanceBy(minutes) { this.totalMinutes += minutes; }
}
