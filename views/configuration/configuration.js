import {
  getConfigurationByHost,
  getDomainFromURL,
  getConfiguration,
  checkConfigObject,
  sanitizeConfig,
} from '../../utils.js';

let edit = false;

function init() {
  registerMenuEventListeners();
  registerRegistrationFormEventListener();
  registerImportFormEventListener();
}

function registerMenuEventListeners() {
  // Add event listeners for the menu items
  const menuItems = document.querySelectorAll('.menu-item');
  const sections = document.getElementsByTagName('section');
  const [, urlSection] = window.location.href.split('#');

  for (let i = 0; i < menuItems.length; i++) {
    if (urlSection) {
      const section = menuItems[i].getAttribute('data-section');
      if (section && section === urlSection) {
        menuItems[i].classList.add('active');
        sections[i].classList.add('active');
        if (section === 'list') {
          loadConfigurationTable();
        }
      }
    } else {
      if (i === 0) {
        menuItems[i].classList.add('active');
        sections[i].classList.add('active');
      }
    }
    menuItems[i].addEventListener('click', async function (event) {
      // Remove the active class from all menu items
      for (let j = 0; j < menuItems.length; j++) {
        menuItems[j].classList.remove('active');
      }
      // Add the active class to the clicked menu item
      event.target.classList.add('active');

      const sectionId = event.target.getAttribute('data-section');
      for (let j = 0; j < sections.length; j++) {
        if (sections[j].id !== sectionId) {
          sections[j].classList.remove('active');
        } else {
          sections[j].classList.add('active');
          if (sectionId === 'list') {
            await loadConfigurationTable();
          }
          window.history.replaceState(null, null, `#${sectionId}`);
        }
      }
    });
  }
}

function registerRegistrationFormEventListener() {
  const form = document.querySelector('.registration-form');
  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const data = {};

    for (let entry of formData.entries()) {
      data[entry[0]] = entry[1];
    }

    const config = await getConfigurationByHost(data.host);
    if (!config || (config && edit)) {
      const { configuration } = await getConfiguration();
      if (edit) {
        const index = configuration.findIndex((c) => c.host === edit);
        configuration[index] = data;
      } else {
        configuration.push(data);
      }
      await chrome.storage.local.set({ configuration });
      showSnackbar('Configuration saved');
      event.target.reset();
      edit = false;
    } else {
      showSnackbar('Configuration already exists', 'error');
    }
  });
}

function registerImportFormEventListener() {
  const form = document.querySelector('.import-form');
  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const formData = new FormData(form);
    const file = formData.get('import_file');
    const reader = new FileReader();
    reader.onload = async function (e) {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch (error) {
        showSnackbar('Invalid JSON file.', 'error');
        event.target.reset();
        return;
      }

      if (!Array.isArray(data)) {
        showSnackbar('Invalid file, please check the example.', 'error');
        event.target.reset();
        return;
      }

      if (data.length === 0) {
        showSnackbar('Empty JSON, there is nothing to import.', 'error');
        event.target.reset();
        return;
      }

      const { configuration } = await getConfiguration();
      data.forEach((config) => {
        if (checkConfigObject(config)) {
          const index = configuration.findIndex((c) => c.host === config.host);
          // Only add new configurations
          if (index === -1) {
            configuration.push(sanitizeConfig(config));
          }
        }
      });

      await chrome.storage.local.set({ configuration });
      showSnackbar('Configuration imported');
      event.target.reset();
    };
    reader.readAsText(file);
  });
}

function registerConfigActionListeners() {
  const editButtons = document.querySelectorAll('.edit-btn');
  editButtons.forEach((button) => {
    button.addEventListener('click', async function (event) {
      const host = event.target.getAttribute('data-host');
      const config = await getConfigurationByHost(getDomainFromURL(host));
      const form = document.querySelector('.registration-form');

      edit = host;

      form.host.value = config.host;
      form.jaeger_url.value = config.jaeger_url;
      form.auth_user.value = config.auth_user;
      form.auth_password.value = config.auth_password;

      navigateToSection('register');
    });
  });

  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', function (event) {
      window.confirm('Are you sure you want to delete this configuration?') &&
        (async () => {
          const host = event.target.getAttribute('data-host');
          const { configuration } = await getConfiguration();
          const newConfiguration = configuration.filter((c) => c.host !== host);
          await chrome.storage.local.set({ configuration: newConfiguration });
          await loadConfigurationTable();
          showSnackbar('Configuration deleted');
        })();
    });
  });
}

async function loadConfigurationTable() {
  const { configuration } = await getConfiguration();
  const table = document.querySelector('.configuration-table tbody');
  table.innerHTML = '';
  configuration.forEach((config) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${config.host}</td>
      <td>${config.jaeger_url}</td>
      <td>${config.auth_user || '-'}</td>
      <td>${config.auth_password || '-'}</td>
      <td>
        <button class="edit-btn" data-host="${config.host}">Edit</button>
        <button class="delete-btn" data-host="${config.host}">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });

  registerConfigActionListeners();
  resetForm();
}

function navigateToSection(section) {
  const menuItems = document.querySelectorAll('.menu-item');
  for (let i = 0; i < menuItems.length; i++) {
    if (menuItems[i].getAttribute('data-section') === section) {
      menuItems[i].click();
    }
  }
}

function resetForm() {
  const form = document.querySelector('.registration-form');
  form.reset();
  edit = false;
}

function showSnackbar(message, type = 'success') {
  if (['success', 'error'].indexOf(type) === -1) {
    throw new Error('Invalid snackbar type');
  }

  const snackbar = document.getElementById('snackbar');

  if (!snackbar) {
    throw new Error('Snackbar not found');
  }

  snackbar.textContent = message;
  snackbar.classList.add(type);

  setTimeout(function () {
    snackbar.classList.remove(type);
  }, 3000);
}

init();
