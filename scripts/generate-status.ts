import { readFileSync, writeFileSync } from "fs";
import fetch from "node-fetch";

type Repo = {
  name: string;
  full_name: string;
  html_url: string;
};

type RepoSet = {
  commonRepos: Repo[];
  foundationRepos: Repo[];
  menuPluginRepos: Repo[];
  editorPluginRepos: Repo[];
  backgroundPluginRepos: Repo[];
  otherRepos: Repo[];
};

const token = process.env.GITHUB_TOKEN;
const headers = { Authorization: `token ${token}` };
const url =
  "https://api.github.com/orgs/OMICRONEnergyOSS/repos?per_page=100&type=public";

const commonRepoNames = ["oscd-api", "oscd-editor"];

const foundationRepoNames = [
  "oscd-shell",
  "oscd-ui",
  "oscd-edit-dialog",
  "oscd-test-utils",
];

const getRepos = async () => {
  const priorityRepos = [...commonRepoNames, ...foundationRepoNames];
  const res = await fetch(url, { headers });
  const json = await res.json();
  if (!Array.isArray(json)) {
    console.log(`Unexpected Response: \n${JSON.stringify(json, null, 4)} `);
    throw new Error("Failed to fetch repositories");
  }

  // Custom sort: priorityRepos first (in order), then the rest alphabetically
  json.sort((a: Repo, b: Repo) => {
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

  return json;
};

function generateStatusTable(heading: string, repos: Repo[] = []) {
  let content = `\n## ${heading}
  | 📘 Repository | ✅ Build Status | 🐛 Issues | 🔁 PRs | 📦 Version |
  |-------------|----------------|----------------|--------|--------|\n`;

  for (const repo of repos) {
    const { name, full_name, html_url } = repo;
    const npmName = full_name.replace("OMICRONEnergyOSS", "@omicronenergy");

    const project = `<a href="${html_url}" target="_blank" rel="noopener">${name} 🔗</a>`;
    const buildStatus = `![Build Status](https://img.shields.io/github/actions/workflow/status/${full_name}/test.yml?branch=main)`;
    const issuesBadgeLink = `![Issues](https://img.shields.io/github/issues/${full_name})<br>[Issues 🔗](${html_url}/issues/)`;
    const pullRequests = `![Pull Requests](https://img.shields.io/github/issues-pr/${full_name})<br>[Pull Requests 🔗](${html_url}/pulls/)`;
    const npmVersion = `![NPM Version](https://img.shields.io/npm/v/${npmName})<br>[NPM 🔗](https://www.npmjs.com/package/${npmName}?activeTab=versions)`;
    // const dependabotStatus = `![Dependabot Status](https://img.shields.io/github/dependabot/status/${full_name})`;

    // Main summary row
    content += `| ${project} | ${buildStatus} | ${issuesBadgeLink} | ${pullRequests} | ${npmVersion} | \n`;
  }

  return content;
}

async function main() {
  const allRepos = await getRepos();

  const template = readFileSync("README.template.md", "utf-8");

  const {
    commonRepos,
    foundationRepos,
    menuPluginRepos,
    editorPluginRepos,
    backgroundPluginRepos,
    otherRepos,
  } = allRepos.reduce(
    (acc: RepoSet, repo: Repo) => {
      if (commonRepoNames.includes(repo.name)) {
        acc.commonRepos.push(repo);
      } else if (foundationRepoNames.includes(repo.name)) {
        acc.foundationRepos.push(repo);
      } else if (repo.name.startsWith("oscd-menu-")) {
        acc.menuPluginRepos.push(repo);
      } else if (repo.name.startsWith("oscd-editor-")) {
        acc.editorPluginRepos.push(repo);
      } else if (repo.name.startsWith("oscd-background-")) {
        acc.backgroundPluginRepos.push(repo);
      } else {
        acc.otherRepos.push(repo);
      }
      return acc;
    },
    {
      commonRepos: [],
      foundationRepos: [],
      menuPluginRepos: [],
      editorPluginRepos: [],
      backgroundPluginRepos: [],
      otherRepos: [],
    }
  );

  let content = `# Repository Status Overview

    ${generateStatusTable("Common Repositories", commonRepos)}
    ${generateStatusTable("Foundation Repositories", foundationRepos)}
    ${generateStatusTable("Menu Plugin Repositories", menuPluginRepos)}
    ${generateStatusTable("Editor Plugin Repositories", editorPluginRepos)}
    ${generateStatusTable(
      "Background Plugin Repositories",
      backgroundPluginRepos
    )}
    ${generateStatusTable("Other Repositories", otherRepos)}
  `;

  const output = template.replace("<!-- STATUS_TABLE -->", content);
  writeFileSync("profile/README.md", output);
  console.log("README.md generated from template.");
}

main().catch(console.error);
