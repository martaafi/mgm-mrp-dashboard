import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
  MachineRequirementSummary,
  LineMachineMatrixRow,
  FilterState,
  DrillDownData,
  DrillDownLineDetail,
  HeatmapCell,
  GapStatus,
  TrendDataPoint,
  ShortageStyleData,
  ShortageMachineData,
} from '../types/mrp';

export const filterProductionPlans = (
  plans: ProductionPlan[],
  filter: FilterState
): ProductionPlan[] => {
  return plans.filter((plan) => {
    if (filter.startDate && plan.date < filter.startDate) {
      return false;
    }
    if (filter.endDate && plan.date > filter.endDate) {
      return false;
    }
    return true;
  });
};

/**
 * Calculates overall sewing machine requirements across all active filtered production plans.
 * If a line runs multiple styles in a single day, the last style in the planning data is used.
 */
export const calculateMachineRequirements = (
  plans: ProductionPlan[],
  requirements: MachineRequirementPerStyle[],
  availabilities: MachineAvailability[]
): MachineRequirementSummary[] => {
  // 1. Determine final style for each (date, line)
  const finalStylePerDateLine: Record<string, string> = {}; // key: "YYYY-MM-DD|Line", value: style
  const linesPerDate: Record<string, string[]> = {};
  
  plans.forEach(plan => {
    const key = `${plan.date}|${plan.line}`;
    // Overwrites previous styles for the same date and line, keeping only the last one
    finalStylePerDateLine[key] = plan.style;
    if (!linesPerDate[plan.date]) linesPerDate[plan.date] = [];
    if (!linesPerDate[plan.date].includes(plan.line)) {
      linesPerDate[plan.date].push(plan.line);
    }
  });

  // Map of machine -> date -> required count
  const dateMachineRequiredMap: Record<string, Record<string, number>> = {};
  const linesUsingMachine: Record<string, Set<string>> = {};

  // Optimize requirements lookup by building a dictionary
  const reqsByStyle: Record<string, MachineRequirementPerStyle[]> = {};
  requirements.forEach(req => {
    if (!reqsByStyle[req.style]) reqsByStyle[req.style] = [];
    reqsByStyle[req.style].push(req);
  });

  Object.entries(finalStylePerDateLine).forEach(([key, style]) => {
    const [date, line] = key.split('|');

    if (line.toUpperCase() === 'ACC') return;

    // Find requirements for this style using dictionary (O(1))
    const styleReqs = reqsByStyle[style] || [];
    
    styleReqs.forEach(req => {
      if (req.kebutuhanTotal <= 0) return; // Skip lines with 0 requirements

      const machineType = req.jenisMesin.trim();
      
      if (!dateMachineRequiredMap[machineType]) {
        dateMachineRequiredMap[machineType] = {};
      }
      
      dateMachineRequiredMap[machineType][date] = 
        (dateMachineRequiredMap[machineType][date] || 0) + req.kebutuhanTotal;

      if (!linesUsingMachine[machineType]) {
        linesUsingMachine[machineType] = new Set();
      }
      linesUsingMachine[machineType].add(line);
    });
  });

  // Calculate ACC requirements
  Object.keys(linesPerDate).forEach(date => {
    const lines = linesPerDate[date];
    const hasACC = lines.some(l => l.toUpperCase() === 'ACC');
    
    if (hasACC) {
      lines.forEach(otherLine => {
        if (otherLine.toUpperCase() !== 'ACC') {
          const otherStyle = finalStylePerDateLine[`${date}|${otherLine}`];
          const otherReqs = reqsByStyle[otherStyle] || [];
          otherReqs.forEach(req => {
            if (req.kebutuhanAccessories && req.kebutuhanAccessories > 0) {
              const machineType = req.jenisMesin.trim();
              if (!dateMachineRequiredMap[machineType]) {
                dateMachineRequiredMap[machineType] = {};
              }
              dateMachineRequiredMap[machineType][date] = 
                (dateMachineRequiredMap[machineType][date] || 0) + req.kebutuhanAccessories;
                
              if (!linesUsingMachine[machineType]) {
                linesUsingMachine[machineType] = new Set();
              }
              linesUsingMachine[machineType].add('ACC');
            }
          });
        }
      });
    }
  });

  // Calculate peak daily requirement per machine type
  const requiredMap: Record<string, number> = {};
  Object.keys(dateMachineRequiredMap).forEach(machineType => {
    const dailyRequirements = Object.values(dateMachineRequiredMap[machineType]);
    requiredMap[machineType] = dailyRequirements.length > 0 
      ? dailyRequirements.reduce((max, val) => (val > max ? val : max), 0) 
      : 0;
  });

  // Combine with available machines list
  const allMachineTypes = new Set([
    ...availabilities.map((a) => a.jenisMesin),
    ...Object.keys(requiredMap),
  ]);

  // Calculate max available per machine type based on all availability entries within the date range
  const maxAvailabilityMap: Record<string, number> = {};
  
  // The available machines data represents the CURRENT physical inventory (today).
  // Regardless of the planned date range, we always compare future requirements against today's physical inventory.
  availabilities.forEach((avail) => {
    const type = avail.jenisMesin.toLowerCase();
    maxAvailabilityMap[type] = Math.max(maxAvailabilityMap[type] || 0, avail.jumlahMesin);
  });

  const result: MachineRequirementSummary[] = [];

  allMachineTypes.forEach((machineType) => {
    const available = maxAvailabilityMap[machineType.toLowerCase()] || 0;
    const required = requiredMap[machineType] || 0;
    const gap = available - required;

    let status: GapStatus = 'Balanced';
    if (gap < 0) {
      status = 'Shortage';
    } else if (gap > 0) {
      status = 'Available';
    }

    const utilizationRaw = available > 0 ? (required / available) * 100 : required > 0 ? 100 : 0;
    const utilization = Number(utilizationRaw.toFixed(1));

    let utilizationLevel: 'low' | 'medium' | 'high' = 'low';
    if (utilization >= 80 && utilization <= 95) {
      utilizationLevel = 'medium';
    } else if (utilization > 95) {
      utilizationLevel = 'high';
    }

    const availObj = availabilities.find(a => a.jenisMesin.toLowerCase() === machineType.toLowerCase());

    result.push({
      machine: machineType,
      required,
      available,
      gap,
      status,
      utilization,
      utilizationLevel,
      linesCount: linesUsingMachine[machineType] ? linesUsingMachine[machineType].size : 0,
      baseCount: availObj?.baseCount ?? 0,
      pinjamCount: availObj?.pinjamCount ?? 0,
      sewaCount: availObj?.sewaCount ?? 0,
    });
  });

  // Sort by required descending as default
  return result.sort((a, b) => b.required - a.required);
};

/**
 * Builds Line-by-Line Machine Requirement Matrix
 */
export const buildLineMachineMatrix = (
  plans: ProductionPlan[],
  requirements: MachineRequirementPerStyle[]
): LineMachineMatrixRow[] => {
  const finalStylePerDateLine: Record<string, ProductionPlan> = {};
  plans.forEach(plan => {
    const key = `${plan.date}|${plan.line}`;
    finalStylePerDateLine[key] = plan;
  });

  const reqsByStyle: Record<string, MachineRequirementPerStyle[]> = {};
  requirements.forEach(req => {
    if (!reqsByStyle[req.style]) reqsByStyle[req.style] = [];
    reqsByStyle[req.style].push(req);
  });

  const dates = Array.from(new Set(plans.map(p => p.date)));
  const result: LineMachineMatrixRow[] = [];

  dates.forEach(date => {
    const datePlans = plans.filter(p => p.date === date);
    const finalPlanPerLine: Record<string, ProductionPlan> = {};
    datePlans.forEach(p => finalPlanPerLine[p.line] = p);

    Object.values(finalPlanPerLine).forEach(plan => {
      const isACC = plan.line.toUpperCase() === 'ACC';
      const machines: Record<string, number> = {};
      let totalMachines = 0;
      
      if (isACC) {
        Object.values(finalPlanPerLine).forEach(otherPlan => {
          if (otherPlan.line.toUpperCase() === 'ACC') return;
          const otherStyleReqs = reqsByStyle[otherPlan.style] || [];
          otherStyleReqs.forEach(req => {
            if (req.kebutuhanAccessories && req.kebutuhanAccessories > 0) {
              const type = req.jenisMesin.trim();
              machines[type] = (machines[type] || 0) + req.kebutuhanAccessories;
              totalMachines += req.kebutuhanAccessories;
            }
          });
        });
      } else {
        const styleReqs = reqsByStyle[plan.style] || [];
        styleReqs.forEach((req) => {
          if (req.kebutuhanTotal > 0) {
            const type = req.jenisMesin.trim();
            machines[type] = (machines[type] || 0) + req.kebutuhanTotal;
            totalMachines += req.kebutuhanTotal;
          }
        });
      }

      result.push({
        line: plan.line,
        style: plan.style,
        kodeStyle: plan.kodeStyle || "",
        qty: plan.qty || 0,
        date: plan.date,
        machines,
        totalMachines,
      });
    });
  });
  
  return result;
};

/**
 * Computes drill-down details for a selected Machine type
 */
export const getMachineDrillDown = (
  machineType: string,
  plans: ProductionPlan[],
  requirements: MachineRequirementPerStyle[],
  availabilities: MachineAvailability[]
): DrillDownData => {
  const availObj = availabilities.find(
    (a) => a.jenisMesin.toLowerCase() === machineType.toLowerCase()
  );
  const totalAvailable = availObj ? availObj.jumlahMesin : 0;

  const lineDetailsMap: Record<string, DrillDownLineDetail> = {};
  const dateRequiredMap: Record<string, number> = {};

  const reqsByStyle: Record<string, MachineRequirementPerStyle[]> = {};
  requirements.forEach(req => {
    if (!reqsByStyle[req.style]) reqsByStyle[req.style] = [];
    reqsByStyle[req.style].push(req);
  });

  const finalStylePerDateLine: Record<string, ProductionPlan> = {};
  plans.forEach(plan => {
    const key = `${plan.date}|${plan.line}`;
    finalStylePerDateLine[key] = plan;
  });

  Object.values(finalStylePerDateLine).forEach((plan) => {
    const isACC = plan.line.toUpperCase() === 'ACC';
    let lineRequired = 0;
    
    if (isACC) {
      const datePlans = Object.values(finalStylePerDateLine).filter(p => p.date === plan.date && p.line.toUpperCase() !== 'ACC');
      datePlans.forEach(otherPlan => {
        const otherReqs = reqsByStyle[otherPlan.style] || [];
        const match = otherReqs.find(r => r.jenisMesin.toLowerCase() === machineType.toLowerCase());
        if (match && match.kebutuhanAccessories > 0) {
          lineRequired += match.kebutuhanAccessories;
        }
      });
    } else {
      const styleReqs = reqsByStyle[plan.style] || [];
      const matchingReqs = styleReqs.filter(
        (req) => req.jenisMesin.toLowerCase() === machineType.toLowerCase()
      );
      if (matchingReqs.length > 0) {
        lineRequired = matchingReqs.reduce((sum, req) => sum + req.kebutuhanTotal, 0);
      }
    }

    if (lineRequired > 0) {
      dateRequiredMap[plan.date] = (dateRequiredMap[plan.date] || 0) + lineRequired;

      if (!lineDetailsMap[plan.line] || lineRequired > lineDetailsMap[plan.line].required) {
        lineDetailsMap[plan.line] = {
          line: plan.line,
          style: isACC ? "ACC (Combined)" : plan.style,
          required: lineRequired,
          date: plan.date,
        };
      }
    }
  });

  const lineDetails = Object.values(lineDetailsMap).sort((a, b) => 
    a.line.localeCompare(b.line, undefined, { numeric: true, sensitivity: 'base' })
  );
  const dailyRequirements = Object.values(dateRequiredMap);
  const totalRequired = dailyRequirements.length > 0 ? dailyRequirements.reduce((max, val) => (val > max ? val : max), 0) : 0;

  const gap = totalAvailable - totalRequired;
  let status: GapStatus = 'Balanced';
  if (gap < 0) status = 'Shortage';
  else if (gap > 0) status = 'Available';

  const utilization =
    totalAvailable > 0
      ? Number(((totalRequired / totalAvailable) * 100).toFixed(1))
      : totalRequired > 0
      ? 100
      : 0;

  // Generate actionable IE recommendation
  let recommendation = '';
  if (gap < 0) {
    const deficit = Math.abs(gap);
    recommendation = `⚠️ PERINGATAN KEKURANGAN: Terdapat total defisit sebanyak ${deficit} unit untuk mesin ${machineType}. Rekomendasi: Pinjam ${deficit} mesin dari inventaris cadangan (buffer offline) atau minta transfer/sewa sementara dari line yang sedang tidak aktif. Evaluasi juga pelatihan silang (cross-training) operator agar mesin dapat dipakai bersama pada stasiun yang berdekatan.`;
  } else if (gap === 0) {
    recommendation = `✅ SEIMBANG: Utilitas kapasitas tepat 100% (Kebutuhan: ${totalRequired} vs Ketersediaan: ${totalAvailable}). Lakukan jadwal perawatan rutin (preventive maintenance); hari ini tidak ada mesin cadangan yang tersisa di pabrik untuk tipe mesin ini.`;
  } else {
    recommendation = `💡 SURPLUS / TERSEDIA: Terdapat ${gap} unit cadangan di inventaris pabrik (Kebutuhan: ${totalRequired} vs Ketersediaan: ${totalAvailable}). Mesin ini dapat dialokasikan untuk pergantian style berikutnya atau dirotasi untuk perawatan berkala.`;
  }

  return {
    machine: machineType,
    totalRequired,
    totalAvailable,
    gap,
    status,
    utilization,
    lineDetails,
    recommendation,
  };
};

/**
 * Extracts unique filter options from the dataset
 */
export const getFilterOptions = (plans: ProductionPlan[]) => {
  const dates = Array.from(new Set(plans.map((p) => p.date))).sort();
  const weeks = Array.from(new Set(plans.map((p) => p.week || ""))).filter(w => w).sort();
  const months = Array.from(
    new Set(plans.map((p) => p.date.substring(0, 7)))
  ).sort();
  const lines = Array.from(new Set(plans.map((p) => p.line))).sort();
  const styles = Array.from(new Set(plans.map((p) => p.style))).sort();

  return { dates, weeks, months, lines, styles };
};

/**
 * Generates Heatmap Matrix data (Line x Machine Type)
 */
export const generateHeatmapData = (
  matrixRows: LineMachineMatrixRow[],
  machineTypes: string[]
): {
  lines: string[];
  machines: string[];
  cells: HeatmapCell[];
} => {
  const lines = matrixRows.map((r) => r.line);
  const cells: HeatmapCell[] = [];

  matrixRows.forEach((row) => {
    machineTypes.forEach((machine) => {
      cells.push({
        line: row.line,
        machine,
        required: row.machines[machine] || 0,
      });
    });
  });

  return {
    lines,
    machines: machineTypes,
    cells,
  };
};

/**
 * Gets the trend of machine gaps over time, skipping Sundays and specified holidays.
 */
export const getGapTrendData = (
  plans: ProductionPlan[],
  requirements: MachineRequirementPerStyle[],
  availabilities: MachineAvailability[],
  holidays: string[] = ["2026-08-17", "2026-08-25"]
): TrendDataPoint[] => {
  if (plans.length === 0) return [];

  // Determine date range from plans
  const dates = Array.from(new Set(plans.map((p) => p.date))).sort();
  const minDateStr = dates[0];
  const maxDateStr = dates[dates.length - 1];

  const startDate = new Date(minDateStr);
  const endDate = new Date(maxDateStr);
  
  const dateRange: string[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay(); // 0 is Sunday
    
    // Include if it's not Sunday AND not a holiday
    if (dayOfWeek !== 0 && !holidays.includes(dateStr)) {
      dateRange.push(dateStr);
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Precompute availabilities
  const maxAvailabilityMap: Record<string, number> = {};
  availabilities.forEach((avail) => {
    const type = String(avail.jenisMesin).toLowerCase();
    maxAvailabilityMap[type] = Math.max(maxAvailabilityMap[type] || 0, avail.jumlahMesin);
  });

  const totalAvailableAcrossAll = Object.values(maxAvailabilityMap).reduce((a, b) => a + b, 0);

  // Group requirements by date and machine
  // 1. Determine final style for each (date, line)
  const finalStylePerDateLine: Record<string, string> = {};
  plans.forEach(plan => {
    finalStylePerDateLine[`${plan.date}|${plan.line}`] = plan.style;
  });

  // 2. Aggregate required machines per date
  const reqsByStyle: Record<string, MachineRequirementPerStyle[]> = {};
  requirements.forEach(req => {
    if (!reqsByStyle[req.style]) reqsByStyle[req.style] = [];
    reqsByStyle[req.style].push(req);
  });

  // date -> machine -> requiredCount
  const dateMachineReqs: Record<string, Record<string, number>> = {};
  
  Object.entries(finalStylePerDateLine).forEach(([key, style]) => {
    const [date, line] = key.split('|');
    const isACC = line.toUpperCase() === 'ACC';
    
    if (!dateMachineReqs[date]) dateMachineReqs[date] = {};
    
    if (isACC) {
      Object.entries(finalStylePerDateLine).forEach(([otherKey, otherStyle]) => {
        const [otherDate, otherLine] = otherKey.split('|');
        if (otherDate === date && otherLine.toUpperCase() !== 'ACC') {
          const otherReqs = reqsByStyle[otherStyle] || [];
          otherReqs.forEach(req => {
            if (req.kebutuhanAccessories && req.kebutuhanAccessories > 0) {
              const mType = String(req.jenisMesin).toLowerCase().trim();
              dateMachineReqs[date][mType] = (dateMachineReqs[date][mType] || 0) + req.kebutuhanAccessories;
            }
          });
        }
      });
    } else {
      const styleReqs = reqsByStyle[style] || [];
      styleReqs.forEach(req => {
        if (req.kebutuhanTotal <= 0) return;
        const mType = String(req.jenisMesin).toLowerCase().trim();
        dateMachineReqs[date][mType] = (dateMachineReqs[date][mType] || 0) + req.kebutuhanTotal;
      });
    }
  });

  // Build the trend data
  const trendData: TrendDataPoint[] = [];

  dateRange.forEach(date => {
    const dailyReqs = dateMachineReqs[date] || {};
    
    const point: TrendDataPoint = {
      date,
      totalRequired: 0,
      totalAvailable: totalAvailableAcrossAll,
      gap: 0
    };

    let totalDailyRequired = 0;

    // Calculate gap per machine type
    Object.keys(maxAvailabilityMap).forEach(machine => {
      const avail = maxAvailabilityMap[machine];
      const req = dailyReqs[machine] || 0;
      const gap = avail - req;
      
      point[machine] = gap; // dynamic key
      totalDailyRequired += req;
    });
    
    // Also add any machines that are required but have 0 availability
    Object.keys(dailyReqs).forEach(machine => {
      if (!maxAvailabilityMap[machine]) {
        point[machine] = 0 - dailyReqs[machine];
        totalDailyRequired += dailyReqs[machine];
      }
    });

    point.totalRequired = totalDailyRequired;
    point.gap = point.totalAvailable - point.totalRequired;
    
    trendData.push(point);
  });

  return trendData;
};

/**
 * Gets styles that caused machine shortages (gap < 0) on any given day.
 */
export const getStyleShortagesData = (
  plans: ProductionPlan[],
  requirements: MachineRequirementPerStyle[],
  availabilities: MachineAvailability[],
  filterMachine?: string
): ShortageStyleData[] => {
  // Map availabilities
  const maxAvailabilityMap: Record<string, number> = {};
  availabilities.forEach((avail) => {
    const type = String(avail.jenisMesin).toLowerCase();
    maxAvailabilityMap[type] = Math.max(maxAvailabilityMap[type] || 0, avail.jumlahMesin);
  });

  // Build dict of requirements
  const reqsByStyle: Record<string, MachineRequirementPerStyle[]> = {};
  requirements.forEach(req => {
    if (!reqsByStyle[req.style]) reqsByStyle[req.style] = [];
    reqsByStyle[req.style].push(req);
  });

  // Calculate daily machine requirements
  const dateMachineReqs: Record<string, Record<string, number>> = {};
  const activeStylesPerDate: Record<string, Set<string>> = {};
  const styleDisplayNames: Record<string, string> = {};

  plans.forEach(plan => {
    if (plan.style && !String(plan.style).toLowerCase().includes("no plan")) {
      if (!activeStylesPerDate[plan.date]) activeStylesPerDate[plan.date] = new Set();
      activeStylesPerDate[plan.date].add(String(plan.style));
      // User specifically requested to show the machine calculation style, not the display style
      styleDisplayNames[String(plan.style)] = String(plan.style);
    }
  });

  const finalStylePerDateLine: Record<string, string> = {};
  plans.forEach(plan => {
    finalStylePerDateLine[`${plan.date}|${plan.line}`] = String(plan.style);
  });


  const styleDailyUsage: Record<string, Record<string, Record<string, number>>> = {};

  Object.entries(finalStylePerDateLine).forEach(([key, style]) => {
    const [date, line] = key.split('|');
    const isACC = line.toUpperCase() === 'ACC';
    
    if (!dateMachineReqs[date]) dateMachineReqs[date] = {};
    if (!styleDailyUsage[date]) styleDailyUsage[date] = {};
    
    if (isACC) {
      Object.entries(finalStylePerDateLine).forEach(([otherKey, otherStyle]) => {
        const [otherDate, otherLine] = otherKey.split('|');
        if (otherDate === date && otherLine.toUpperCase() !== 'ACC') {
          const otherReqs = reqsByStyle[otherStyle] || [];
          otherReqs.forEach(req => {
            if (req.kebutuhanAccessories && req.kebutuhanAccessories > 0) {
              const mType = String(req.jenisMesin).toLowerCase().trim();
              dateMachineReqs[date][mType] = (dateMachineReqs[date][mType] || 0) + req.kebutuhanAccessories;
              if (!styleDailyUsage[date][otherStyle]) styleDailyUsage[date][otherStyle] = {};
              styleDailyUsage[date][otherStyle][mType] = (styleDailyUsage[date][otherStyle][mType] || 0) + req.kebutuhanAccessories;
            }
          });
        }
      });
    } else {
      const styleReqs = reqsByStyle[style] || [];
      if (!styleDailyUsage[date][style]) styleDailyUsage[date][style] = {};
      styleReqs.forEach(req => {
        if (req.kebutuhanTotal <= 0) return;
        const mType = String(req.jenisMesin).toLowerCase().trim();
        dateMachineReqs[date][mType] = (dateMachineReqs[date][mType] || 0) + req.kebutuhanTotal;
        styleDailyUsage[date][style][mType] = (styleDailyUsage[date][style][mType] || 0) + req.kebutuhanTotal;
      });
    }
  });

  const shortageMap = new Map<string, ShortageStyleData>();

  // Find shortages
  Object.keys(dateMachineReqs).forEach(date => {
    const dailyReqs = dateMachineReqs[date];
    const activeStyles = activeStylesPerDate[date] || new Set();

    Object.keys(dailyReqs).forEach(machine => {
      const avail = maxAvailabilityMap[machine] || 0;
      const req = dailyReqs[machine];
      const gap = avail - req;

      if (gap < 0) {
        if (filterMachine && filterMachine !== "ALL" && machine.toLowerCase() !== filterMachine.toLowerCase()) {
          return; // Skip if we are filtering by a specific machine and this isn't it
        }

        // This machine is short on this date!
        const totalReqForMachine = dailyReqs[machine];
        
        // Find all active styles today that USE this machine
        activeStyles.forEach(style => {
          const usage = styleDailyUsage[date]?.[style]?.[machine] || 0;
          
          if (usage > 0) {
            let sData = shortageMap.get(style);
            if (!sData) {
              sData = {
                styleName: style,
                displayStyle: styleDisplayNames[String(style)] || String(style),
                shortageCount: 0,
                machinesShort: []
              };
              shortageMap.set(style, sData);
            }
            
            // Weight is the percentage of the machine requirement that this style contributed to
            const weight = usage / totalReqForMachine;
            sData.shortageCount += weight;
            
            // Log it
            sData.machinesShort.push({
              machine,
              gap,
              date
            });
          }
        });
      }
    });
  });

  // Sort by weighted shortage frequency and round to 2 decimals
  return Array.from(shortageMap.values())
    .map(data => ({
      ...data,
      shortageCount: Math.round(data.shortageCount * 100) / 100
    }))
    .sort((a, b) => b.shortageCount - a.shortageCount);
};

/**
 * Gets the machines that are most frequently in shortage.
 */
export const getMachineShortagesData = (
  plans: ProductionPlan[],
  requirements: MachineRequirementPerStyle[],
  availabilities: MachineAvailability[]
): ShortageMachineData[] => {
  // Map availabilities
  const maxAvailabilityMap: Record<string, number> = {};
  availabilities.forEach((avail) => {
    const type = String(avail.jenisMesin).toLowerCase();
    maxAvailabilityMap[type] = Math.max(maxAvailabilityMap[type] || 0, avail.jumlahMesin);
  });

  // Build dict of requirements
  const reqsByStyle: Record<string, MachineRequirementPerStyle[]> = {};
  requirements.forEach(req => {
    if (!reqsByStyle[req.style]) reqsByStyle[req.style] = [];
    reqsByStyle[req.style].push(req);
  });

  const finalStylePerDateLine: Record<string, string> = {};
  plans.forEach(plan => {
    if (plan.style && !String(plan.style).toLowerCase().includes("no plan")) {
      finalStylePerDateLine[`${plan.date}|${plan.line}`] = String(plan.style);
    }
  });

  const dateMachineReqs: Record<string, Record<string, number>> = {};

  Object.entries(finalStylePerDateLine).forEach(([key, style]) => {
    const [date, line] = key.split('|');
    const isACC = line.toUpperCase() === 'ACC';
    
    if (!dateMachineReqs[date]) dateMachineReqs[date] = {};
    
    if (isACC) {
      Object.entries(finalStylePerDateLine).forEach(([otherKey, otherStyle]) => {
        const [otherDate, otherLine] = otherKey.split('|');
        if (otherDate === date && otherLine.toUpperCase() !== 'ACC') {
          const otherReqs = reqsByStyle[otherStyle] || [];
          otherReqs.forEach(req => {
            if (req.kebutuhanAccessories && req.kebutuhanAccessories > 0) {
              const mType = String(req.jenisMesin).toLowerCase().trim();
              dateMachineReqs[date][mType] = (dateMachineReqs[date][mType] || 0) + req.kebutuhanAccessories;
            }
          });
        }
      });
    } else {
      const styleReqs = reqsByStyle[style] || [];
      styleReqs.forEach(req => {
        if (req.kebutuhanTotal <= 0) return;
        const mType = String(req.jenisMesin).toLowerCase().trim();
        dateMachineReqs[date][mType] = (dateMachineReqs[date][mType] || 0) + req.kebutuhanTotal;
      });
    }
  });

  const shortageMap = new Map<string, ShortageMachineData>();

  // Find shortages
  Object.keys(dateMachineReqs).forEach(date => {
    const dailyReqs = dateMachineReqs[date];

    Object.keys(dailyReqs).forEach(machine => {
      const avail = maxAvailabilityMap[machine] || 0;
      const req = dailyReqs[machine];
      const gap = avail - req;

      if (gap < 0) {
        let mData = shortageMap.get(machine);
        if (!mData) {
          mData = {
            machine: machine.toUpperCase(),
            shortageCount: 0,
            totalShortageVolume: 0,
            maxShortageVolume: 0,
            avgShortageVolume: 0,
            dates: []
          };
          shortageMap.set(machine, mData);
        }
        
        const absGap = Math.abs(gap);
        mData.shortageCount += 1;
        mData.totalShortageVolume += absGap;
        mData.maxShortageVolume = Math.max(mData.maxShortageVolume, absGap);
        mData.dates.push(date);
      }
    });
  });

  // Calculate averages
  shortageMap.forEach(mData => {
    if (mData.shortageCount > 0) {
      mData.avgShortageVolume = Math.round((mData.totalShortageVolume / mData.shortageCount) * 10) / 10;
    }
  });

  // Sort by frequency of shortage first, then by total volume
  return Array.from(shortageMap.values()).sort((a, b) => {
    if (b.shortageCount !== a.shortageCount) {
      return b.shortageCount - a.shortageCount;
    }
    return b.totalShortageVolume - a.totalShortageVolume;
  });
};

