// ABOUTME: Text of the first-visit tour. Demo mode describes what the demo really does
// ABOUTME: (fictional data in this browser, bring-your-own key); real mode describes the shared app.

export type TourStep = { title: string; body: string };

export function tourCopy(name: string, demo: boolean): TourStep[] {
  return [
    {
      title: `Welcome to ${name}'s Care Hub`,
      body: demo
        ? `This is a demo of a family care dashboard. ${name} is a made-up patient: every value, visit and document here is fictional, and it is all stored only in this browser.`
        : `PSA history, care team, treatment plan, medications and ${name}'s records in one place, shared with everyone who has the dashboard password.`,
    },
    {
      title: "Every section, one source of truth",
      body: "Today has the PSA chart and key numbers. Labs shows every metric pulled from uploaded documents. Plan tracks appointments. Documents, Team, Learn and Activity are in the sidebar on desktop, or under the tab bar and More on a phone.",
    },
    {
      title: "Watch the PSA trend",
      body: "The chart on Today plots every reading since diagnosis. Below it are the latest PSA value, the doubling time, the next appointment and the scan threshold: the four numbers that drive decisions.",
    },
    {
      title: "Keep everything current",
      body: demo
        ? "Tap Edit on Today or Team to unlock edit mode. Add PSA readings, update the KPI cards, manage medications and change care team members. Changes are saved in this browser, and Reset demo data in the Demo menu at the top puts everything back."
        : "Tap Edit on Today or Team to unlock edit mode. Add PSA readings, update the KPI cards, manage medications and change care team members. Changes save instantly for everyone who signs in.",
    },
    {
      title: demo ? "Try the sample documents" : "Upload any medical document",
      body: demo
        ? "Go to Documents and open a sample document: it shows suggested updates with no key needed. With your own Anthropic API key you can also extract updates from your own .txt, .md or .csv files. You review and choose what to apply."
        : "Go to Documents and add a PDF, photo, Word or text file. Claude reads it and suggests updates such as new PSA values, medications or team changes. You review and choose what to apply.",
    },
    {
      title: "Ask anything about his records",
      body: demo
        ? `Open the Assistant from the button in the top bar. It answers from ${name}'s fictional record once you add your own Anthropic API key, which stays in this tab. Try "What was ${name}'s last PSA?" or "When is the next scan?"`
        : `Open the Assistant from the button in the top bar. Try plain questions like "What was ${name}'s last PSA?" or "When is the next scan?" All answers come from his records.`,
    },
    {
      title: "You're all set",
      body: demo
        ? "The Assistant and visit prep use your own key; the sample documents work without one. Reset demo data or read About this demo anytime from the Demo menu in the top bar, and re-open this tour with the Tour button on Today."
        : "Everything updates in real time for everyone who signs in. Re-open this tour anytime with the Tour button on Today.",
    },
  ];
}
