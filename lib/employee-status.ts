import { promises as fs } from "fs";
import path from "path";
import { Employee } from "./types";
import { createAdminSupabaseClient } from "./supabase/server";

export { isActiveEmployee, activeEmployees } from "./utils";

type StatusFile = {
  updatedAt: string;
  byKey: Record<string, boolean>;
};

const FILE = path.join(process.cwd(), ".vacate-data", "employee-status.json");

function statusKey(emp: { id?: string; employeeNo?: string }): string | null {
  const no = emp.employeeNo?.trim();
  if (no && no !== "—") return `no:${no}`;
  if (emp.id) return `id:${emp.id}`;
  return null;
}

async function readStatusFile(): Promise<StatusFile> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const data = JSON.parse(raw) as StatusFile;
    if (!data?.byKey || typeof data.byKey !== "object") {
      return { updatedAt: new Date().toISOString(), byKey: {} };
    }
    return data;
  } catch {
    return { updatedAt: new Date().toISOString(), byKey: {} };
  }
}

async function writeStatusFile(file: StatusFile): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(file, null, 2));
}

export async function applyEmployeeStatus(
  employees: Employee[]
): Promise<Employee[]> {
  // The staff master already contains the durable status in production.
  // Never allow a bundled, stale JSON overlay to override that status.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return employees;
  const file = await readStatusFile();
  return employees.map((e) => {
    const key = statusKey(e);
    const overlay = key ? file.byKey[key] : undefined;
    return {
      ...e,
      active: overlay ?? e.active ?? true,
    };
  });
}

export async function setEmployeeActive(input: {
  id: string;
  employeeNo?: string;
  active: boolean;
}): Promise<void> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const sb = createAdminSupabaseClient();
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id);
    const employeeNo = input.employeeNo?.trim();
    if (!uuidLike && (!employeeNo || employeeNo === "—")) {
      throw new Error("This employee must be added to the staff master before their status can be changed.");
    }
    const query = sb.from("employees").update({ active: input.active });
    const { data, error } = await (uuidLike ? query.eq("id", input.id) : query.eq("employee_no", employeeNo!)).select("id");
    if (error) throw new Error(`Could not save employee status: ${error.message}`);
    if (!data?.length) throw new Error("Employee not found in the staff master. Refresh the directory and try again.");
    return;
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("Employee status storage is not configured. Configure Supabase before changing status.");
  }
  const file = await readStatusFile();
  const keys = [
    statusKey({ id: input.id, employeeNo: input.employeeNo }),
    statusKey({ id: input.id }),
  ].filter(Boolean) as string[];
  for (const key of keys) file.byKey[key] = input.active;
  file.updatedAt = new Date().toISOString();
  await writeStatusFile(file);
}
