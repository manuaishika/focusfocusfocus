document.addEventListener('DOMContentLoaded', async () => {
  const permanentTasksContainer = document.getElementById('permanent-tasks-container');
  const tasksContainer = document.getElementById('tasks-container');
  const newTaskInput = document.getElementById('new-task-input');
  const taskTypeSelect = document.getElementById('task-type-select');
  const addTaskBtn = document.getElementById('add-task-btn');
  const togglePermanentEditBtn = document.getElementById('toggle-permanent-edit');

  if (!chrome || !chrome.storage) {
    if (tasksContainer) {
      tasksContainer.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const PERMANENT_DEFAULTS = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];

  const remindersList = document.getElementById('reminders-list');
  const addReminderBtn = document.getElementById('add-reminder-btn');
  const remindersEnabledCheckbox = document.getElementById('reminders-enabled');

  let currentPermanentTasks = [];
  let currentCustomTasks = [];
  let currentTaskUrls = {};
  let currentTaskTypes = {};
  let editingPermanent = false;
  let reminderTimes = [];
  let remindersEnabled = true;

  function updateEditButtonLabel() {
    if (!togglePermanentEditBtn) return;
    togglePermanentEditBtn.textContent = editingPermanent ? 'Done Editing' : 'Edit Permanent Tasks';
    togglePermanentEditBtn.classList.toggle('active', editingPermanent);
  }

  async function loadTasks() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'taskUrls', 'taskTypes']);
      currentPermanentTasks =
        Array.isArray(result.permanentTasks) && result.permanentTasks.length
          ? [...result.permanentTasks]
          : [...PERMANENT_DEFAULTS];
      currentCustomTasks = Array.isArray(result.tasks) ? [...result.tasks] : [];
      currentTaskUrls = result.taskUrls || {};
      currentTaskTypes = result.taskTypes || {};

      // Ensure permanent tasks are marked as daily
      let shouldPersistTypes = false;
      currentPermanentTasks.forEach(task => {
        if (currentTaskTypes[task] !== 'daily') {
          currentTaskTypes[task] = 'daily';
          shouldPersistTypes = true;
        }
      });
      if (shouldPersistTypes) {
        chrome.storage.local.set({ taskTypes: currentTaskTypes });
      }

      renderPermanentTasks();
      renderTasks();
      updateEditButtonLabel();
    } catch (error) {
      if (tasksContainer) {
        tasksContainer.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading tasks:', error);
    }
  }

  function renderPermanentTasks() {
    if (!permanentTasksContainer) return;
    permanentTasksContainer.innerHTML = '';

    if (!currentPermanentTasks.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'No permanent tasks. Add custom tasks below or re-add defaults by reinstalling.';
      permanentTasksContainer.appendChild(empty);
      return;
    }

    currentPermanentTasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row permanent-task-row';

      const taskHeader = document.createElement('div');
      taskHeader.className = 'task-header';

      const taskName = document.createElement('span');
      taskName.className = 'task-name';
      taskName.textContent = task;

      const permanentBadge = document.createElement('span');
      permanentBadge.className = 'task-type-badge task-type-daily';
      permanentBadge.textContent = 'Permanent';
      taskName.appendChild(permanentBadge);

      taskHeader.appendChild(taskName);

      if (editingPermanent) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-permanent-btn';
        deleteBtn.textContent = 'Remove';
        deleteBtn.addEventListener('click', () => removePermanentTask(task));
        taskHeader.appendChild(deleteBtn);
      }

      taskRow.appendChild(taskHeader);

      const urlSection = document.createElement('div');
      urlSection.className = 'task-url-section';

      const urlLabel = document.createElement('label');
      urlLabel.textContent = 'Website URL:';

      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'https://example.com (leave empty for manual tracking)';
      urlInput.value = currentTaskUrls[task] || '';
      urlInput.addEventListener('change', async () => {
        try {
          const updatedUrls = { ...(currentTaskUrls || {}) };
          updatedUrls[task] = urlInput.value.trim();
          currentTaskUrls = updatedUrls;
          await chrome.storage.local.set({ taskUrls: updatedUrls });
        } catch (error) {
          console.error('Error saving task URL:', error);
        }
      });

      urlSection.appendChild(urlLabel);
      urlSection.appendChild(urlInput);
      taskRow.appendChild(urlSection);

      permanentTasksContainer.appendChild(taskRow);
    });
  }

  function renderTasks() {
    if (!tasksContainer) return;
    tasksContainer.innerHTML = '';

    const customTasks = currentCustomTasks.filter(task => !currentPermanentTasks.includes(task));

    if (!customTasks.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'No custom tasks yet. Add one below!';
      tasksContainer.appendChild(empty);
      return;
    }

    customTasks.forEach(task => {
      const taskRow = document.createElement('div');
      taskRow.className = 'task-row';

      const taskHeader = document.createElement('div');
      taskHeader.className = 'task-header';

      const taskName = document.createElement('span');
      taskName.className = 'task-name';
      taskName.textContent = task;

      const taskType = currentTaskTypes[task] || 'daily';
      const typeBadge = document.createElement('span');
      typeBadge.className = `task-type-badge task-type-${taskType}`;
      typeBadge.textContent = taskType === 'daily' ? 'Daily' : 'One-Time';
      taskName.appendChild(typeBadge);

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteCustomTask(task));

      taskHeader.appendChild(taskName);
      taskHeader.appendChild(deleteBtn);
      taskRow.appendChild(taskHeader);

      const urlSection = document.createElement('div');
      urlSection.className = 'task-url-section';

      const urlLabel = document.createElement('label');
      urlLabel.textContent = 'Website URL:';

      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'https://example.com (leave empty for manual tracking)';
      urlInput.value = currentTaskUrls[task] || '';
      urlInput.addEventListener('change', async () => {
        try {
          const updatedUrls = { ...(currentTaskUrls || {}) };
          updatedUrls[task] = urlInput.value.trim();
          currentTaskUrls = updatedUrls;
          await chrome.storage.local.set({ taskUrls: updatedUrls });
        } catch (error) {
          console.error('Error saving task URL:', error);
        }
      });

      urlSection.appendChild(urlLabel);
      urlSection.appendChild(urlInput);
      taskRow.appendChild(urlSection);

      tasksContainer.appendChild(taskRow);
    });
  }

  async function removePermanentTask(task) {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'taskUrls', 'taskTypes']);
      const permanentTasks = (result.permanentTasks || []).filter(t => t !== task);
      const taskUrls = result.taskUrls || {};
      const taskTypes = result.taskTypes || {};

      delete taskUrls[task];
      delete taskTypes[task];

      await chrome.storage.local.set({ permanentTasks, taskUrls, taskTypes });
      await loadTasks();
    } catch (error) {
      console.error('Error removing permanent task:', error);
    }
  }

  async function deleteCustomTask(task) {
    try {
      const result = await chrome.storage.local.get(['tasks', 'progress', 'taskUrls', 'taskTypes']);
      const tasks = (result.tasks || []).filter(t => t !== task);
      const progress = result.progress || {};
      const taskUrls = result.taskUrls || {};
      const taskTypes = result.taskTypes || {};

      Object.keys(progress).forEach(date => {
        if (progress[date] && progress[date][task]) {
          delete progress[date][task];
          if (Object.keys(progress[date]).length === 0) {
            delete progress[date];
          }
        }
      });

      delete taskUrls[task];
      delete taskTypes[task];

      await chrome.storage.local.set({ tasks, progress, taskUrls, taskTypes });
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  }

  if (togglePermanentEditBtn) {
    togglePermanentEditBtn.addEventListener('click', () => {
      editingPermanent = !editingPermanent;
      updateEditButtonLabel();
      renderPermanentTasks();
    });
  }

  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', async () => {
      const taskName = newTaskInput ? newTaskInput.value.trim() : '';
      const taskType = taskTypeSelect ? taskTypeSelect.value : 'onetime';

      if (!taskName) return;

      if (currentPermanentTasks.includes(taskName) || currentCustomTasks.includes(taskName)) {
        return;
      }

      try {
        currentCustomTasks.push(taskName);
        currentTaskUrls[taskName] = '';
        currentTaskTypes[taskName] = taskType;

        await chrome.storage.local.set({
          tasks: currentCustomTasks,
          taskUrls: currentTaskUrls,
          taskTypes: currentTaskTypes
        });

        if (newTaskInput) {
          newTaskInput.value = '';
        }
        if (taskTypeSelect) {
          taskTypeSelect.value = 'onetime';
        }

        await loadTasks();
      } catch (error) {
        console.error('Error adding task:', error);
      }
    });
  }

  if (newTaskInput) {
    newTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && addTaskBtn) {
        addTaskBtn.click();
      }
    });
  }

  // Reminders functionality
  async function loadReminders() {
    try {
      const result = await chrome.storage.local.get(['reminderTimes', 'remindersEnabled']);
      reminderTimes = result.reminderTimes || [];
      remindersEnabled = result.remindersEnabled !== false; // Default to true
      
      if (remindersEnabledCheckbox) {
        remindersEnabledCheckbox.checked = remindersEnabled;
      }
      
      renderReminders();
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  }

  function renderReminders() {
    if (!remindersList) return;
    remindersList.innerHTML = '';
    
    if (reminderTimes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-message';
      empty.textContent = 'No reminders set. Add reminder times above.';
      remindersList.appendChild(empty);
      return;
    }
    
    reminderTimes.forEach((time, index) => {
      const reminderItem = document.createElement('div');
      reminderItem.className = 'reminder-item';
      
      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.value = time;
      timeInput.className = 'reminder-time-input';
      timeInput.addEventListener('change', async () => {
        reminderTimes[index] = timeInput.value;
        await chrome.storage.local.set({ reminderTimes });
        scheduleReminders();
      });
      
      const timeLabel = document.createElement('div');
      timeLabel.className = 'reminder-time';
      timeLabel.appendChild(timeInput);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-reminder-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', async () => {
        reminderTimes.splice(index, 1);
        await chrome.storage.local.set({ reminderTimes });
        await loadReminders();
        scheduleReminders();
      });
      
      reminderItem.appendChild(timeLabel);
      reminderItem.appendChild(removeBtn);
      remindersList.appendChild(reminderItem);
    });
  }

  async function scheduleReminders() {
    if (!remindersEnabled || reminderTimes.length === 0) {
      // Clear all reminder alarms
      const alarms = await chrome.alarms.getAll();
      alarms.forEach(alarm => {
        if (alarm.name.startsWith('reminder_')) {
          chrome.alarms.clear(alarm.name);
        }
      });
      return;
    }
    
    // Clear existing reminder alarms
    const alarms = await chrome.alarms.getAll();
    alarms.forEach(alarm => {
      if (alarm.name.startsWith('reminder_')) {
        chrome.alarms.clear(alarm.name);
      }
    });
    
    // Schedule new reminders
    const now = new Date();
    reminderTimes.forEach((time, index) => {
      const [hours, minutes] = time.split(':').map(Number);
      const reminderTime = new Date();
      reminderTime.setHours(hours, minutes, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (reminderTime <= now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }
      
      chrome.alarms.create(`reminder_${index}`, {
        when: reminderTime.getTime(),
        periodInMinutes: 60 * 24 // Repeat daily
      });
    });
  }

  if (addReminderBtn) {
    addReminderBtn.addEventListener('click', async () => {
      const defaultTime = new Date();
      defaultTime.setHours(9, 0, 0, 0); // Default to 9:00 AM
      const timeStr = `${String(defaultTime.getHours()).padStart(2, '0')}:${String(defaultTime.getMinutes()).padStart(2, '0')}`;
      
      reminderTimes.push(timeStr);
      await chrome.storage.local.set({ reminderTimes });
      await loadReminders();
      await scheduleReminders();
    });
  }

  if (remindersEnabledCheckbox) {
    remindersEnabledCheckbox.addEventListener('change', async () => {
      remindersEnabled = remindersEnabledCheckbox.checked;
      await chrome.storage.local.set({ remindersEnabled });
      await scheduleReminders();
    });
  }

  loadTasks();
  loadReminders();
});
