export class EfficiencyUtil {
  static readonly BASE_AVAILABLE_MINUTES = 390;

  static calculateEfficiency(overtimeHours: number, downtimeMinutes: number) {
    const safeOvertime = Math.max(0, overtimeHours || 0);
    const safeDowntime = Math.max(0, downtimeMinutes || 0);

    const overtimeMinutes = safeOvertime * 60;
    const availableMinutes = this.BASE_AVAILABLE_MINUTES + overtimeMinutes;
    
    // actual run minutes doesn't go below 0
    const actualRunMinutes = Math.max(0, availableMinutes - safeDowntime);
    
    let timeEfficiency = 0;
    if (availableMinutes > 0) {
      timeEfficiency = (actualRunMinutes / availableMinutes) * 100;
    }
    
    return {
      availableMinutes,
      actualRunMinutes,
      timeEfficiency
    };
  }

  static calculateAggregateEfficiency(sessions: Array<{ overtimeHours?: number, downtimeMinutes?: number }>) {
    let totalAvailable = 0;
    let totalActual = 0;

    sessions.forEach(s => {
      const eff = this.calculateEfficiency(s.overtimeHours || 0, s.downtimeMinutes || 0);
      totalAvailable += eff.availableMinutes;
      totalActual += eff.actualRunMinutes;
    });

    let timeEfficiency = 0;
    if (totalAvailable > 0) {
      timeEfficiency = (totalActual / totalAvailable) * 100;
    }

    return {
      totalAvailableMinutes: totalAvailable,
      totalActualRunMinutes: totalActual,
      timeEfficiency
    };
  }
}
