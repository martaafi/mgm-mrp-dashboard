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
  
  plans.forEach(plan => {
    const key = `${plan.date}|${plan.line}`;
    // Overwrites previous styles for the same date and line, keeping only the last one
    finalStylePerDateLine[key] = plan.style;
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

  return Object.values(finalStylePerDateLine).map((plan) => {
    const styleReqs = reqsByStyle[plan.style] || [];

    const machines: Record<string, number> = {};
    let totalMachines = 0;

    styleReqs.forEach((req) => {
      const type = req.jenisMesin.trim();
      machines[type] = (machines[type] || 0) + req.kebutuhanTotal;
      totalMachines += req.kebutuhanTotal;
    });

    return {
      line: plan.line,
      style: plan.style,
      kodeStyle: plan.kodeStyle || "",
      qty: plan.qty || 0,
      date: plan.date,
      machines,
      totalMachines,
    };
  });
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
    const styleReqs = reqsByStyle[plan.style] || [];
    const matchingReqs = styleReqs.filter(
      (req) => req.jenisMesin.toLowerCase() === machineType.toLowerCase()
    );

    if (matchingReqs.length > 0) {
      const lineRequired = matchingReqs.reduce((sum, req) => sum + req.kebutuhanTotal, 0);
      
      if (lineRequired > 0) {
        // Track requirement per date to find peak daily requirement
        dateRequiredMap[plan.date] = (dateRequiredMap[plan.date] || 0) + lineRequired;

        // Track max usage per line for the drill down details
        if (!lineDetailsMap[plan.line] || lineRequired > lineDetailsMap[plan.line].required) {
          lineDetailsMap[plan.line] = {
            line: plan.line,
            style: plan.style,
            required: lineRequired,
            date: plan.date,
          };
        }
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
