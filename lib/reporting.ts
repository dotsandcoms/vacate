import { config } from "./config";
import { todayIso } from "./holidays";
import { LeaveRequest } from "./types";

export function reportingFrom(): string {
  return config.reportingFrom;
}

/** Human label for the reporting start, e.g. "January 2025". */
export function reportingFromLabel(): string {
  const [y, m] = config.reportingFrom.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[(m || 1) - 1]} ${y}`;
}

export function reportingWindowLabel(): string {
  return `${reportingFromLabel()} – today`;
}

/**
 * Leave that starts on/after the reporting from-date.
 * Upcoming leave after today is kept so ops pages stay useful.
 */
export function isInReportingWindow(startDate: string): boolean {
  return Boolean(startDate) && startDate >= config.reportingFrom;
}

/** Leave taken from reporting from-date through today (YTD stats). */
export function isTakenYtd(startDate: string, today = todayIso()): boolean {
  return isInReportingWindow(startDate) && startDate <= today;
}

export function filterReportingWindow(
  requests: LeaveRequest[]
): LeaveRequest[] {
  return requests.filter((r) => isInReportingWindow(r.startDate));
}
