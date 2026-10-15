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
      title: "Seven tabs, one source of truth",
      body: "Overview has the PSA chart and key numbers. Labs shows every metric pulled from uploaded documents. Plan tracks appointments. Care Team, Daily Care, Background and Records are all a tap away.",
    },
    {
      title: "Watch the PSA trend",
      body: "The chart on Overview plots every reading since diagnosis. Below it are the latest PSA value, the doubling time, the next appointment and the scan threshold: the four numbers that drive decisions.",
    },
    {
      title: "Keep everything current",
      body: demo
        ? "Tap Edit in the dashboard header to unlock edit mode. Add PSA readings, update the KPI cards, manage medications and change care team members. Changes are saved in this browser, and Reset demo data in the banner puts everything back."
        : "Tap Edit in the dashboard header to unlock edit mode. Add PSA readings, update the KPI cards, manage medications and change care team members. Changes save instantly for everyone who signs in.",
    },
    {
      title: demo ? "Try the sample documents" : "Upload any medical document",
      body: demo
        ? "Go to the Records tab and open a sample document: it shows suggested updates with no key needed. With your own Anthropic API key you can also extract updates from your own .txt, .md or .csv files. You review and choose what to apply."
        : "Go to the Records tab and add a PDF, photo, Word or text file. Claude reads it and suggests updates such as new PSA values, medications or team changes. You review and choose what to apply.",
    },
    {
      title: "Ask anything about his records",
      body: demo
        ? `Chat answers from ${name}'s fictional record once you add your own Anthropic API key, which stays in this tab. Try "What was ${name}'s last PSA?" or "When is the next scan?"`
        : `Tap Chat on mobile or use the side panel on desktop. Try plain questions like "What was ${name}'s last PSA?" or "When is the next scan?" All answers come from his records.`,
    },
    {
      title: "You're all set",
      body: demo
        ? "Chat and visit prep use your own key; the sample documents work without one. Reset demo data anytime from the banner, and re-open this tour with the Tour button in the dashboard header."
        : "Everything updates in real time for everyone who signs in. Re-open this tour anytime with the Tour button in the dashboard header.",
    },
  ];
}
