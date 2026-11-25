// Task Manager Extended – plain JavaScript + Supabase REST API (PostgREST)
//
// Database: categories (1) ──< tasks (many), linked by tasks.category_id → categories.id
// Every request goes to  {supabaseUrl}/rest/v1/{table}{query}
// with the publishable key in the "apikey" header.

let config = null;       // loaded from config.json
let categories = [];     // cached list of categories [{id, name}]
let editingId = null;    // id of the task being edited, or null when adding

// ---------- page elements ----------
const statusMessage    = document.getElementById('status-message');
const categoryList     = document.getElementById('category-list');
const categoryForm     = document.getElementById('category-form');
const categoryName     = document.getElementById('category-name');
const taskForm         = document.getElementById('task-form');
const titleInput       = document.getElementById('task-title');
const descriptionInput = document.getElementById('task-description');
const taskCategory     = document.getElementById('task-category');
const submitButton     = document.getElementById('task-submit');
const cancelButton     = document.getElementById('task-cancel');
const formHeading      = document.getElementById('form-heading');
const filterCategory   = document.getElementById('filter-category');
const filterStatus     = document.getElementById('filter-status');
const taskList         = document.getElementById('task-list');
const taskCount        = document.getElementById('task-count');
const appInfo          = document.getElementById('app-info');

// ---------- helpers ----------

function showStatus(text, type) {
  statusMessage.textContent = text;
  statusMessage.className = type || '';
}

// Generic request to the Supabase REST API.
// table: 'tasks' or 'categories', query: e.g. '?select=*', body: object for POST/PATCH
async function api(method, table, query, body) {
  const url = config.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' + table + (query || '');
  const options = {
    method: method,
    headers: {
      'apikey': config.supabasePublishableKey,   // publishable key goes ONLY in this header
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'          // ask Supabase to return the saved rows
    }
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, options);
  } catch (e) {
    throw new Error('Network error – could not reach Supabase.');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (e) { data = text; }
  }
  if (!response.ok) {
    const details = data && data.message ? data.message : '';
    throw new Error('Server error ' + response.status + (details ? ': ' + details : ''));
  }
  return data;
}

// ---------- REST operations: categories ----------

// GET /categories?select=*
function getCategories() {
  return api('GET', config.categoriesTableName, '?select=*&order=id.asc');
}

// POST /categories
function createCategory(name) {
  return api('POST', config.categoriesTableName, '', { name: name });
}

// ---------- REST operations: tasks ----------

// GET /tasks?select=*,categories(name)  (+ optional filters)
// categories(name) tells Supabase to follow the foreign key and attach the category name.
// Filters:  category_id=eq.1   and/or   completed=eq.false
function getTasks(categoryId, completed) {
  let query = '?select=*,categories(name)';
  if (categoryId !== 'all') query += '&category_id=eq.' + encodeURIComponent(categoryId);
  if (completed !== 'all')  query += '&completed=eq.' + completed;   // 'true' or 'false'
  query += '&order=id.asc';
  return api('GET', config.tableName, query);
}

// GET /tasks?id=eq.1&select=*
async function getTaskById(id) {
  const rows = await api('GET', config.tableName, '?id=eq.' + id + '&select=*');
  return rows && rows.length ? rows[0] : null;
}

// POST /tasks
function createTask(title, description, categoryId) {
  return api('POST', config.tableName, '', {
    title: title,
    description: description,
    completed: false,
    category_id: categoryId
  });
}

// PATCH /tasks?id=eq.1  – sends only the fields that change (e.g. title, category_id, completed)
function updateTask(id, changes) {
  return api('PATCH', config.tableName, '?id=eq.' + id, changes);
}

// DELETE /tasks?id=eq.1
function deleteTask(id) {
  return api('DELETE', config.tableName, '?id=eq.' + id);
}

// ---------- categories UI ----------

function renderCategories() {
  // 1) category "chips"
  categoryList.innerHTML = '';
  categories.forEach(function (category) {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.dataset.id = category.id;
    li.textContent = category.name;
    categoryList.appendChild(li);
  });

  // 2) <select> in the task form
  const selectedInForm = taskCategory.value;
  taskCategory.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— choose a category —';
  taskCategory.appendChild(placeholder);
  categories.forEach(function (category) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    taskCategory.appendChild(option);
  });
  taskCategory.value = selectedInForm;

  // 3) <select> in the filter
  const selectedFilter = filterCategory.value;
  filterCategory.innerHTML = '<option value="all">All categories</option>';
  categories.forEach(function (category) {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = category.name;
    filterCategory.appendChild(option);
  });
  filterCategory.value = categories.some(c => String(c.id) === selectedFilter) ? selectedFilter : 'all';
}

async function loadCategories() {
  try {
    categories = await getCategories();
    renderCategories();
  } catch (error) {
    showStatus('Could not load categories. ' + error.message, 'error');
  }
}

categoryForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  const name = categoryName.value.trim();
  if (!name) return;
  try {
    await createCategory(name);
    categoryName.value = '';
    showStatus('Category "' + name + '" added.', 'success');
    await loadCategories();
  } catch (error) {
    showStatus('Could not add the category. ' + error.message, 'error');
  }
});

// ---------- tasks UI ----------

function renderTasks(tasks) {
  taskList.innerHTML = '';
  taskCount.textContent = 'Showing ' + tasks.length + (tasks.length === 1 ? ' task' : ' tasks');

  if (tasks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No tasks match the selected filters.';
    taskList.appendChild(empty);
    return;
  }

  tasks.forEach(function (task) {
    const item = document.createElement('div');
    item.className = 'task-item' + (task.completed ? ' done' : '');
    item.dataset.id = task.id;

    const header = document.createElement('div');
    header.className = 'task-header';

    const title = document.createElement('h3');
    title.className = 'task-title';
    title.textContent = task.title;

    // task.categories comes from the embedded resource categories(name)
    const category = document.createElement('span');
    category.className = 'task-category';
    category.textContent = task.categories ? task.categories.name : 'No category';

    header.append(title, category);

    const description = document.createElement('p');
    description.className = 'task-description';
    description.textContent = task.description || '';

    const status = document.createElement('p');
    status.className = 'task-status';
    status.textContent = task.completed ? 'Completed' : 'Not completed';

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(
      makeButton('toggle-task', task.completed ? 'Mark incomplete' : 'Mark complete', function () { onToggle(task); }),
      makeButton('edit-task', 'Edit', function () { onEdit(task.id); }),
      makeButton('delete-task', 'Delete', function () { onDelete(task.id); })
    );

    item.append(header, description, status, actions);
    taskList.appendChild(item);
  });
}

function makeButton(className, text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

async function loadTasks() {
  try {
    const tasks = await getTasks(filterCategory.value, filterStatus.value);
    renderTasks(tasks);
  } catch (error) {
    showStatus('Could not load tasks. ' + error.message, 'error');
  }
}

// Filters: reload tasks from the API whenever a filter changes
filterCategory.addEventListener('change', loadTasks);
filterStatus.addEventListener('change', loadTasks);

// ---------- task form: add / edit ----------

function resetForm() {
  editingId = null;
  taskForm.reset();
  submitButton.textContent = 'Add task';
  formHeading.textContent = 'Add a new task';
  cancelButton.hidden = true;
}

taskForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const categoryId = Number(taskCategory.value);

  if (!title)      { showStatus('Task title is required.', 'error'); return; }
  if (!categoryId) { showStatus('Please choose a category.', 'error'); return; }

  submitButton.disabled = true;
  try {
    if (editingId === null) {
      await createTask(title, description, categoryId);
      showStatus('Task added.', 'success');
    } else {
      await updateTask(editingId, { title: title, description: description, category_id: categoryId });
      showStatus('Task updated.', 'success');
    }
    resetForm();
    await loadTasks();
  } catch (error) {
    showStatus('Could not save the task. ' + error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

cancelButton.addEventListener('click', function () {
  resetForm();
  showStatus('', '');
});

// ---------- task buttons ----------

async function onEdit(id) {
  try {
    const task = await getTaskById(id);
    if (!task) throw new Error('This task no longer exists.');
    editingId = task.id;
    titleInput.value = task.title;
    descriptionInput.value = task.description || '';
    taskCategory.value = task.category_id === null ? '' : String(task.category_id);
    submitButton.textContent = 'Save changes';
    formHeading.textContent = 'Edit task #' + task.id;
    cancelButton.hidden = false;
    titleInput.focus();
    showStatus('Editing task #' + task.id + '.', '');
  } catch (error) {
    showStatus('Could not open the task for editing. ' + error.message, 'error');
  }
}

async function onToggle(task) {
  try {
    await updateTask(task.id, { completed: !task.completed });
    showStatus(task.completed ? 'Task marked as incomplete.' : 'Task marked as completed.', 'success');
    await loadTasks();
  } catch (error) {
    showStatus('Could not change the task status. ' + error.message, 'error');
  }
}

async function onDelete(id) {
  try {
    await deleteTask(id);
    if (editingId === id) resetForm();
    showStatus('Task deleted.', 'success');
    await loadTasks();
  } catch (error) {
    showStatus('Could not delete the task. ' + error.message, 'error');
  }
}

// ---------- start ----------

async function loadInfo() {
  try {
    const info = await (await fetch('info.json', { cache: 'no-store' })).json();
    appInfo.textContent = info.applicationName + ' v' + info.version + ' · student ' + info.studentId;
  } catch (e) {
    appInfo.textContent = '';
  }
}

async function init() {
  loadInfo();
  try {
    const response = await fetch('config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    config = await response.json();
  } catch (error) {
    showStatus('Could not load config.json. ' + error.message, 'error');
    return;
  }
  config.tableName = config.tableName || 'tasks';
  config.categoriesTableName = config.categoriesTableName || 'categories';

  if (!config.supabaseUrl || !config.supabasePublishableKey ||
      config.supabaseUrl.indexOf('YOUR_PROJECT_ID') !== -1 ||
      config.supabasePublishableKey.indexOf('YOUR_KEY') !== -1) {
    showStatus('config.json is not filled in yet: set supabaseUrl and supabasePublishableKey.', 'error');
    return;
  }

  await loadCategories();
  await loadTasks();
}

init();
