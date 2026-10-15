// Daily cron: emails upcoming appointments from plan_items.
// Runs at 13:00 UTC. Requires RESEND_API_KEY + NOTIFY_EMAIL secrets.
// Gracefully no-ops if secrets are missing (safe to deploy without them). Optional APP_NAME
// sets the name in the subject, sender and body (default "Care Dashboard").

/** Escapes text for HTML, so plan-item titles and notes cannot inject markup into the email. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req) => {
  // Accept only POST (pg_cron sends POST). Reject unexpected methods.
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // Optional cron secret — set CRON_SECRET in Supabase secrets to lock this
  // endpoint so only pg_cron (which sends it in the Authorization header) can call it.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!resendKey || !notifyEmail) {
    console.log("notify-appointments: RESEND_API_KEY or NOTIFY_EMAIL not set — skipping");
    return new Response("ok", { status: 200 });
  }

  const dbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const res = await fetch(
    `${supabaseUrl}/rest/v1/plan_items?event_date=gte.${todayStr}&event_date=lte.${nextWeekStr}&select=title,event_date,body,status&order=event_date.asc`,
    { headers: dbHeaders },
  );

  if (!res.ok) {
    console.error("notify-appointments: failed to fetch plan_items", await res.text());
    return new Response("error", { status: 500 });
  }

  const items = (await res.json()) as {
    title: string;
    event_date: string;
    body: string;
    status: string;
  }[];

  if (items.length === 0) {
    console.log("notify-appointments: no upcoming items — skipping email");
    return new Response("ok", { status: 200 });
  }

  function fmtDate(d: string) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  const rows = items
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-weight:600;color:#1c1917">${fmtDate(i.event_date)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;color:#1c1917">${escapeHtml(i.title)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#78716c">${escapeHtml(i.status ?? "")}</td>
    </tr>
    ${i.body ? `<tr><td colspan="3" style="padding:0 12px 10px 12px;font-size:13px;color:#57534e;border-bottom:1px solid #f5f5f4">${escapeHtml(i.body)}</td></tr>` : ""}
  `,
    )
    .join("");

  const appName = Deno.env.get("APP_NAME") ?? "Care Dashboard";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#fafaf9;margin:0;padding:0">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#1c1917 0%,#292524 100%);padding:24px 32px">
      <p style="margin:0;color:rgba(255,255,255,0.45);font-size:11px;letter-spacing:0.1em;text-transform:uppercase">${escapeHtml(appName)}</p>
      <h1 style="margin:8px 0 0;color:white;font-size:22px;font-weight:700">Upcoming appointments</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.5);font-size:13px">Next 7 days — ${fmtDate(todayStr)} through ${fmtDate(nextWeekStr)}</p>
    </div>
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="border-bottom:2px solid #e5e5e5">
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#a8a29e;letter-spacing:0.07em;text-transform:uppercase">Date</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#a8a29e;letter-spacing:0.07em;text-transform:uppercase">Item</th>
            <th style="text-align:left;padding:8px 12px;font-size:11px;color:#a8a29e;letter-spacing:0.07em;text-transform:uppercase">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px 24px;border-top:1px solid #f5f5f4">
      <p style="margin:0;font-size:12px;color:#a8a29e">This is an automated daily digest from ${escapeHtml(appName)}. Reply to this email to reach the family.</p>
    </div>
  </div>
</body>
</html>`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${appName} <onboarding@resend.dev>`,
      to: [notifyEmail],
      subject: `${appName} — ${items.length} upcoming item${items.length === 1 ? "" : "s"} (next 7 days)`,
      html,
    }),
  });

  if (!emailRes.ok) {
    console.error("notify-appointments: Resend error", emailRes.status, await emailRes.text());
    return new Response("email error", { status: 502 });
  }

  console.log(`notify-appointments: sent ${items.length} items to ${notifyEmail}`);
  return new Response("ok", { status: 200 });
});
