import { readFileSync, writeFileSync } from "fs";
import fetch from "node-fetch";

const token = process.env.GH_TOKEN;
const headers = { Authorization: `token ${token}` };

const priorityRepos = [
  "oscd-api",
  "oscd-editor",
  "oscd-shell",
  "oscd-ui",
  "oscd-test-utils",
];

const getRepos = async () => {
  const allRepos = await fetchJSON(
    "https://api.github.com/orgs/OMICRONEnergyOSS/repos?per_page=100&type=public"
  );
  const oscdRepos = allRepos.filter((repo: any) =>
    repo.name.startsWith("oscd-")
  );

  // Custom sort: priorityRepos first (in order), then the rest alphabetically
  oscdRepos.sort((a: any, b: any) => {
    const aIndex = priorityRepos.indexOf(a.name);
    const bIndex = priorityRepos.indexOf(b.name);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex; // Both in priority list, keep their order
    }
    if (aIndex !== -1) return -1; // a is priority, comes first
    if (bIndex !== -1) return 1; // b is priority, comes first

    // Neither in priority list, sort alphabetically
    return a.name.localeCompare(b.name);
  });

  return oscdRepos;
};

async function fetchJSON(url: string) {
  const res = await fetch(url, { headers });
  return res.json();
}

async function generateStatusTable() {
  const now = new Date().toLocaleString();
  const repos = await getRepos();
  let table = `# 🔍 Repository Status Overview\n\nLast Updated: ${now}\n\n`;

  table += "| 📘 Repository | ✅ Build Status | 🐛 Issues | 🔁 PRs | \n";
  table += "|-------------|----------------|----------------|--------|\n";

  for (const repo of repos) {
    const { name, full_name, html_url } = repo;

    const project = `<a href="${html_url}" target="_blank" rel="noopener">${name} 🔗</a>`;
    const buildStatus = `![Build Status](https://img.shields.io/github/actions/workflow/status/${full_name}/test.yml?branch=main)`;
    const issuesBadgeLink = `![Issues](https://img.shields.io/github/issues/${full_name})<br>[Issues 🔗](${html_url}/issues/)`;
    const pullRequests = `![Pull Requests](https://img.shields.io/github/issues-pr/${full_name})<br>[Pull Requests 🔗](${html_url}/pulls/)`;
    // const dependabotStatus = `![Dependabot Status](https://img.shields.io/github/dependabot/status/${full_name})`;

    // Main summary row
    table += `| ${project} | ${buildStatus} | ${issuesBadgeLink} | ${pullRequests} | \n`;
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
