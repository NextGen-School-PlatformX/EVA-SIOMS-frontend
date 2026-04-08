// ============================================================
// TYPES
// ============================================================

export type Role = 
  | "Admin" 
  | "HR"
  | "Accountant" 
  | "StoreKeeper"
  | "WorkshopEngineer"
  | "CanteenManager"
  | "Employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  profileImage?: string | null;   // ← stored path from server
  permissions: PageId[];
  employeeId?: string | null;
}

export type PageId =
  | "dashboard"
  | "attendance"
  | "hr"
  | "payroll"
  | "canteen"
  | "inventory"
  | "suppliers"
  | "workshop"
  | "assets"
  | "settings";

export interface NavItem {
  id: PageId;
  label: string;
  icon: string;
  group: string;
}

export interface Employee {
  id: number;
  employeeId: string;
  name: string;
  department: string;
  position: string;
  salary: number;
  status: "Active" | "On Leave";
  joinDate: string;
  phone: string;
  email: string;
  attendance: number;
  avatar: string;
}

export interface InventoryItem {
  id: number; sku: string; name: string; category: string;
  quantity: number; minStock: number; unit: string; unitPrice: number;
  supplier: string; location: string; lastUpdated: string;
}

export interface Supplier {
  id: number; name: string; contact: string; email: string;
  category: string; totalOrders: number; totalValue: number;
  status: "Active" | "Inactive"; rating: number; lastOrder: string;
}

export interface AttendanceRecord {
  id: number; employeeId: string; employeeName: string; department: string;
  date: string; checkIn: string | null; checkOut: string | null;
  status: "Present" | "Absent" | "Late" | "Weekend";
}

export interface PayrollRecord {
  employeeId: string; employeeName: string; department: string;
  baseSalary: number; overtime: number; bonus: number;
  penalties: number; taxDeduction: number; insuranceDeduction: number;
  customDeductions?: { name: string; rate: number; amount: number }[];
  netSalary: number; month: string; status: "Paid" | "Pending";
}

export interface CanteenProduct {
  id: number; name: string; price: number; stock: number;
  category: string; sales: number;
}

export interface CartItem extends CanteenProduct { qty: number; }

export interface Equipment {
  id: number; name: string; model: string;
  status: "Active" | "Under Maintenance" | "Out of Service";
  department: string; lastMaintenance: string; nextMaintenance: string;
  condition: "Excellent" | "Good" | "Fair" | "Poor";
}

export interface Asset {
  id: number; assetId: string; name: string; assignedTo: string;
  employeeId: string; assignDate: string; returnDate: string | null;
  status: "In Use" | "Returned"; condition: "Excellent" | "Good" | "Fair" | "Poor";
}

export interface RevenueDataPoint {
  month: string; canteen: number; inventory: number; services: number;
}

export interface AttendanceDataPoint {
  day: string; present: number; absent: number; late: number;
}
