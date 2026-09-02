import { Panel } from "@/components/dash";

type Item = { title: string; body: string };

function List({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.title} className="rounded-md border border-border bg-background p-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-foreground">{i.title}</p>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-muted-foreground">{i.body}</p>
        </li>
      ))}
    </ul>
  );
}

const ADMIN: Item[] = [
  {
    title: "Overview",
    body: "Total operators, open bets, stake and payout across every operator. Quick health check of the platform.",
  },
  {
    title: "Operators",
    body: "Create a new operator (client), set currency, callback URL and callback secret, change status to active / suspended, set plan amount and expiry, and assign the owner login that may open the operator panel.",
  },
  {
    title: "API keys",
    body: "Issue a key for an operator. The full key is shown only once at creation — copy it and hand it to the client. Revoke disables the key immediately; the prefix stays in the list for audit.",
  },
  {
    title: "IP / Domain",
    body: "Add the server IPs and site domains the operator is allowed to call the API from. A request from any other IP or origin is rejected even with a valid key.",
  },
  {
    title: "Results",
    body: "See live rounds from the feed and declare a manual result when the provider feed is missing or wrong. Declaring a result settles all open bets on that round.",
  },
  {
    title: "Callback wallet",
    body: "Test the operator's wallet endpoints (balance / debit / credit / rollback) with signed requests. Use it after a client sets up their callback URL to confirm the integration works.",
  },
  {
    title: "Bet history",
    body: "Every bet placed through the API for the selected operator with stake, odds, payout and status. Filterable audit trail for settlement disputes.",
  },
  {
    title: "Not possible here",
    body: "Admin cannot see or change an operator's own player passwords, and cannot move real money — money movement always happens on the operator's wallet through signed callbacks.",
  },
];

const OPERATOR: Item[] = [
  {
    title: "Overview",
    body: "Your operator name, currency, plan status and expiry, plus total stake, payout and open bets on your account.",
  },
  {
    title: "Callback wallet",
    body: "Enter a player id and test balance / debit / credit / rollback against your own wallet endpoint. Use it while integrating to confirm your signature check and responses are correct.",
  },
  {
    title: "My bet history",
    body: "All bets your players placed through your API key, with round, selection, odds, stake, payout and status.",
  },
  { title: "Rounds", body: "Recent rounds and their declared results for reconciliation." },
  {
    title: "Keys & whitelist",
    body: "See your active key prefixes and manage the IPs / domains allowed to call the API. Full keys are issued by the admin and shown only once.",
  },
  {
    title: "Callback logs",
    body: "Every request we sent to your wallet endpoint with the payload, HTTP status and response. First place to look when a debit or credit fails.",
  },
  {
    title: "Not possible here",
    body: "You cannot issue or revoke your own API keys, declare results, or view other operators' data — contact the admin for those.",
  },
];

export function AdminGuide() {
  return (
    <Panel title="Admin kit — what each section does">
      <List items={ADMIN} />
    </Panel>
  );
}

export function OperatorGuide() {
  return (
    <Panel title="Operator kit — what each section does">
      <List items={OPERATOR} />
    </Panel>
  );
}
