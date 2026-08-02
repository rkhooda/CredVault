/**
 * The credential lifecycle, as one system.
 *
 * `CredentialStatus` in src/lib/credentials.ts is the on-chain enum. The UI also
 * needs `expired`, which is derived rather than stored: the contract reports
 * isExpired alongside an Active status once expiresAt has passed.
 *
 * Everything that renders a status — badge, card treatment, filter, verdict —
 * reads from this file, so a status can never look like two different things on
 * two different screens.
 */
import { Ban, CircleSlash, Clock, FileQuestion, ShieldCheck, TimerOff, type LucideIcon } from "lucide-react";
import { CredentialStatus, type CredentialRecord } from "@/lib/credentials";

export type DisplayStatus = "none" | "pending" | "active" | "expired" | "rejected" | "revoked";

/** Collapses the on-chain status plus the expiry flag into a single display state. */
export function displayStatus(record: Pick<CredentialRecord, "status" | "isExpired">): DisplayStatus {
  switch (record.status) {
    case CredentialStatus.Pending:
      return "pending";
    case CredentialStatus.Active:
      return record.isExpired ? "expired" : "active";
    case CredentialStatus.Rejected:
      return "rejected";
    case CredentialStatus.Revoked:
      return "revoked";
    default:
      return "none";
  }
}

export interface StatusMeta {
  /** Short label for badges and filters. */
  label: string;
  /** What this state means, in the holder's terms. */
  description: string;
  icon: LucideIcon;
  /** Badge surface: tinted fill, hairline border, accessible text colour. */
  badgeClass: string;
  /** Accent used for the card's status edge. */
  edgeClass: string;
  /** Text-only colour, for verdicts and inline notes. */
  textClass: string;
  /** True when the credential currently proves anything. */
  isGood: boolean;
}

export const STATUS_META: Record<DisplayStatus, StatusMeta> = {
  active: {
    label: "Valid",
    description: "Accepted by the holder and active on-chain.",
    icon: ShieldCheck,
    badgeClass: "border-success/25 bg-success/10 text-success",
    edgeClass: "bg-success",
    textClass: "text-success",
    isGood: true,
  },
  pending: {
    label: "Awaiting holder",
    description: "Issued, but the holder has not accepted it yet.",
    icon: Clock,
    badgeClass: "border-warning/30 bg-warning/10 text-warning",
    edgeClass: "bg-warning",
    textClass: "text-warning",
    isGood: false,
  },
  expired: {
    label: "Expired",
    description: "This credential was valid, but its expiry date has passed.",
    icon: TimerOff,
    badgeClass: "border-warning/30 bg-warning/10 text-warning",
    edgeClass: "bg-warning",
    textClass: "text-warning",
    isGood: false,
  },
  rejected: {
    label: "Declined",
    description: "The holder declined this credential.",
    icon: Ban,
    badgeClass: "border-border-strong bg-muted text-muted-foreground",
    edgeClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
    isGood: false,
  },
  revoked: {
    label: "Revoked",
    description: "The issuing institution withdrew this credential.",
    icon: CircleSlash,
    badgeClass: "border-destructive/25 bg-destructive/10 text-destructive",
    edgeClass: "bg-destructive",
    textClass: "text-destructive",
    isGood: false,
  },
  none: {
    label: "Not found",
    description: "No record exists on-chain for this holder and document hash.",
    icon: FileQuestion,
    badgeClass: "border-border-strong bg-muted text-muted-foreground",
    edgeClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
    isGood: false,
  },
};

/** Filter options shared by both dashboards, so the two lists behave the same. */
export const STATUS_FILTERS: { value: DisplayStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Valid" },
  { value: "pending", label: "Awaiting holder" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
  { value: "rejected", label: "Declined" },
];
