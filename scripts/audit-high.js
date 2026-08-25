'use strict';

const { spawnSync } = require('node:child_process');

const ALLOWED_ADVISORY_URLS = new Set([
  // Temporary: legacy brace-expansion v1/v2 have no published fix for CVE-2026-14257.
  // These copies are only used by Expo/Jest/ESLint build tooling with trusted patterns.
  'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
  // Temporary: image-size is only reached through Metro while processing trusted local assets.
  // Expo SDK 54 cannot take the patched parser; remove these with the tracked SDK upgrade (#76).
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
]);

function isNonBlockingAdvisory(advisory) {
  if (!advisory || typeof advisory !== 'object') return false;
  if (advisory.severity !== 'high' && advisory.severity !== 'critical') return true;
  return ALLOWED_ADVISORY_URLS.has(advisory.url);
}

function collectAdvisoryCauses(name, vulnerabilities, visiting = new Set()) {
  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return { advisories: [], hasUnknownCause: true };
  if (visiting.has(name)) return { advisories: [], hasUnknownCause: false };

  const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
  if (via.length === 0) return { advisories: [], hasUnknownCause: true };

  const nextVisiting = new Set(visiting);
  nextVisiting.add(name);

  return via.reduce((result, cause) => {
    if (typeof cause !== 'string') {
      result.advisories.push(cause);
      return result;
    }

    const nested = collectAdvisoryCauses(cause, vulnerabilities, nextVisiting);
    result.advisories.push(...nested.advisories);
    result.hasUnknownCause ||= nested.hasUnknownCause;
    return result;
  }, { advisories: [], hasUnknownCause: false });
}

function isCausedOnlyByAllowlistedAdvisories(name, vulnerabilities) {
  const { advisories, hasUnknownCause } = collectAdvisoryCauses(name, vulnerabilities);
  return !hasUnknownCause
    && advisories.length > 0
    && advisories.every(isNonBlockingAdvisory);
}

function getBlockingVulnerabilities(vulnerabilities = {}) {
  return Object.entries(vulnerabilities)
    .filter(([, vulnerability]) => (
      vulnerability.severity === 'high' || vulnerability.severity === 'critical'
    ))
    .filter(([name]) => !isCausedOnlyByAllowlistedAdvisories(name, vulnerabilities))
    .map(([name]) => name);
}

function runAudit() {
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.error || !result.stdout) {
    console.error('npm audit failed before returning valid JSON.');
    if (result.error) console.error(result.error.message);
    if (result.stderr) console.error(result.stderr.trim());
    return 1;
  }

  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch (error) {
    console.error('npm audit returned invalid JSON.');
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const vulnerabilities = audit.vulnerabilities ?? {};
  const blockers = getBlockingVulnerabilities(vulnerabilities);
  const counts = audit.metadata?.vulnerabilities ?? {};
  const allowlisted = Object.keys(vulnerabilities).filter(name => (
    (vulnerabilities[name].severity === 'high' || vulnerabilities[name].severity === 'critical')
    && isCausedOnlyByAllowlistedAdvisories(name, vulnerabilities)
  ));

  console.log(`npm audit: ${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low.`);

  if (allowlisted.length > 0) {
    console.warn(
      `Temporarily allowlisted Expo toolchain advisory chains (${allowlisted.length} packages; tracked in #76).`,
    );
  }

  if (blockers.length > 0) {
    console.error(`Blocking high/critical vulnerabilities: ${blockers.join(', ')}`);
    return 1;
  }

  console.log('No non-allowlisted high or critical vulnerabilities.');
  return 0;
}

if (require.main === module) {
  process.exitCode = runAudit();
}

module.exports = {
  getBlockingVulnerabilities,
  isCausedOnlyByAllowlistedAdvisories,
  runAudit,
};
