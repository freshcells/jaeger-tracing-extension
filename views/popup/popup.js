import {
  getConfigurationByHost,
  getCurrentTabHostname,
  cleanPastRequests,
  getDomainFromURL,
  getRequests,
  cleanRequestsByHost,
} from '../../utils.js';

async function init() {
  await cleanPastRequests();
  const { requests } = await getRequests();

  if (requests) {
    await mountTableContent(requests);
  }

  document
    .getElementById('config-page-btn')
    .addEventListener('click', openConfigPage);

  document
    .getElementById('clean-requests-btn')
    .addEventListener('click', cleanRequests);
}

async function mountTableContent(requests) {
  const hostname = await getCurrentTabHostname();
  const table = document.getElementById('request_list');
  if (!table) {
    throw new Error('Could not find table');
  }

  const config = await getConfigurationByHost(hostname);

  const filtered = requests.filter((request) => {
    const requestHostname = getDomainFromURL(request.initiator);
    return requestHostname === hostname;
  });

  if (filtered.length) {
    filtered.forEach((request) => {
      const row = table.insertRow(-1);
      row.insertCell(-1).innerHTML = request.method;
      row.insertCell(-1).innerHTML = request.status;
      row.insertCell(-1).innerHTML = request.description;
      row.insertCell(-1).innerHTML = request.time.toFixed(2) + 'ms';
      row.insertCell(-1).innerHTML = config
        ? `<a href="${mountJaegerLink(
            config.jaeger_url,
            request.traceId,
            config.user,
            config.pwd
          )}" rel="noopener noreferrer" target="_blank">See on Jaeger</a>`
        : 'Please, configure the extension for this host';
    });
  } else {
    table.innerHTML = `
      <thead>
        <tr>
          <th>Method</th>
          <th>Status</th>
          <th class="description">Description</th>
          <th>Duration</th>
          <th>Trace</th>
        </tr>
      </thead>
      `;
  }
}

async function openConfigPage() {
  const tabURL = chrome.runtime.getURL('views/configuration/index.html');
  const result = await chrome.tabs.query({
    url: tabURL,
  });

  if (!result.length) {
    await chrome.tabs.create({ url: tabURL });
  } else {
    await chrome.tabs.update(result[0].id, { active: true });
  }
}

async function cleanRequests() {
  const hostname = await getCurrentTabHostname();
  await cleanRequestsByHost(hostname);
  const { requests } = await getRequests();
  await mountTableContent(requests);
}

function mountJaegerLink(url, traceId, user, pwd) {
  if (Boolean(user) && Boolean(pwd)) {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.protocol +
      '//' +
      user +
      ':' +
      pwd +
      '@' +
      parsedUrl.host +
      parsedUrl.pathname +
      traceId
    );
  }

  return url + traceId;
}

init();