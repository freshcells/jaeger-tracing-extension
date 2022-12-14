export async function getConfiguration() {
  const { configuration } = await chrome.storage.local.get('configuration');
  return !configuration ? { configuration: [] } : { configuration };
}

export async function getConfigurationByHost(host) {
  const { configuration } = await getConfiguration();
  return configuration.find((c) => getDomainFromURL(c.host) === host);
}

export async function getCurrentTabHostname() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tabs[0].url);
  return url.hostname;
}

export function getDomainFromURL(href) {
  const url = new URL(href);
  return url.hostname;
}

export async function getRequests() {
  const { requests } = await chrome.storage.local.get('requests');
  return !requests ? { requests: [] } : { requests };
}

export async function cleanPastRequests() {
  const { requests } = await getRequests();
  const traceDate = new Date();

  traceDate.setHours(0, 0, 0, 0);
  const newRequests = requests.filter(
    (request) => new Date(request.traceDate).getTime() === traceDate.getTime()
  );

  await chrome.storage.local.set({ requests: newRequests });
}

export async function cleanRequestsByHost(host) {
  const { requests } = await getRequests();
  const newRequests = requests.filter(
    (request) => getDomainFromURL(request.initiator) !== host
  );

  await chrome.storage.local.set({ requests: newRequests });
}

export function checkConfigObject(config) {
  return (
    config.host &&
    config.jaeger_url &&
    'auth_user' in config &&
    'auth_password' in config
  );
}

export function sanitizeConfig(config) {
  return {
    host: config.host,
    jaeger_url: config.jaeger_url,
    auth_user: config.auth_user,
    auth_password: config.auth_password,
    enable_search: Boolean(config.enable_search) || false,
  };
}

export function numberToMonth(number) {
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  return months[number];
}
