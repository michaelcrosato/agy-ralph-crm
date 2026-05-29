export const SERVICE_LITE_VERSION = "0.1.0";

export interface TicketInsert {
  orgId: string;
  contactId: string;
  subject: string;
}

export interface TicketRecord {
  id: string;
  orgId: string;
  contactId: string;
  subject: string;
  status: "Open" | "In Progress" | "Resolved";
  createdAt: Date;
}

// createTicket is a first-party module extension function to initialize support tickets
export function createTicket(ticket: TicketInsert): TicketRecord {
  return {
    id: `ticket-${Math.random().toString(36).substring(2, 11)}`,
    orgId: ticket.orgId,
    contactId: ticket.contactId,
    subject: ticket.subject,
    status: "Open",
    createdAt: new Date(),
  };
}

// resolveTicket handles ticket transition states safely
export function resolveTicket(ticket: TicketRecord): TicketRecord {
  return {
    ...ticket,
    status: "Resolved",
  };
}
