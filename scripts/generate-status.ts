import { readFileSync, writeFileSync } from "fs";
import fetch from "node-fetch";

const token = process.env.GH_TOKEN;
const headers = { Authorization: `token ${token}` };

const repos = [
  "OMICRONEnergyOSS/oscd-api",
  "OMICRONEnergyOSS/oscd-editor",
  "OMICRONEnergyOSS/oscd-ui",
  "OMICRONEnergyOSS/oscd-testing",
  "OMICRONEnergyOSS/oscd-shell",
];

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers });
  return res.json();
}

async function getRepoStatus(repo: string) {
  const [owner, name] = repo.split("/");

  const [runs, issues, prs, alerts] = await Promise.all([
    fetchJSON(`https://api.github.com/repos/${repo}/actions/runs`),
    fetchJSON(
      `https://api.github.com/repos/${repo}/issues?state=open&labels=v1.0`
    ),
    fetchJSON(`https://api.github.com/repos/${repo}/pulls?state=open`),
    fetchJSON(`https://api.github.com/repos/${repo}/dependabot/alerts`),
  ]);

  let buildStatusRaw = runs.workflow_runs?.[0]?.conclusion ?? "no_runs";
  let buildStatus = "";

  switch (buildStatusRaw) {
    case "success":
      buildStatus = "✅";
      break;
    case "failure":
      buildStatus = "❌";
      break;
    case "cancelled":
      buildStatus = "🚫";
      break;
    case "in_progress":
      buildStatus = "⏳";
      break;
    default:
      buildStatus = "❔";
  }

  const v1Issues = issues.filter((i: any) => !i.pull_request);
  const openPRs = prs;
  const depUpdates = Array.isArray(alerts) ? alerts.length : 0;

  return { name, repo, buildStatus, v1Issues, openPRs, depUpdates };
}

async function generateStatusTable() {
  const now = new Date().toLocaleString();
  let table = `# 🔍 Repository Status Overview\n\nLast Updated: ${now}\n\n`;

  table +=
    "| 📘 Repo Name | ✅ Build Status | 🐛 v1.0 Issues | 🔁 PRs | 📦 Dependency Updates |\n";
  table +=
    "|-------------|----------------|----------------|--------|------------------------|\n";

  for (const repo of repos) {
    const { name, buildStatus, v1Issues, openPRs, depUpdates } =
      await getRepoStatus(repo);

    // Main summary row
    table += `| ${name} | ${buildStatus} | ${v1Issues.length} | ${openPRs.length} | ${depUpdates} |\n`;

    // Sub-row for issues and PRs
    const issuesList = v1Issues.length
      ? v1Issues
          .map(
            (i: any) =>
              `[${i.title}](https://github.com/${repo}/issues/${i.number})`
          )
          .join("<br>")
      : "_None_";
    const prsList = openPRs.length
      ? openPRs
          .map(
            (pr: any) =>
              `[${pr.title}](https://github.com/${repo}/pull/${pr.number})`
          )
          .join("<br>")
      : "_None_";

    table += `| | | ${issuesList} | ${prsList} | |\n`;
  }

  return table;
}

async function main() {
  const template = readFileSync("README.template.md", "utf-8");
  const statusTable = await generateStatusTable();

  const output = template.replace("<!-- STATUS_TABLE -->", statusTable);
  writeFileSync("profile/README.md", output);
  console.log("README.md generated from template.");
}

main().catch(console.error);
