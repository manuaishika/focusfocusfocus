document.addEventListener('DOMContentLoaded', async () => {
  const tasksList = document.getElementById('tasks-list');
  const viewHeatmapBtn = document.getElementById('view-heatmap');
  const optionsBtn = document.getElementById('options');
  const toggleAddTaskBtn = document.getElementById('toggle-add-task');
  const addTaskForm = document.getElementById('add-task-form');
  const newTaskInput = document.getElementById('new-task-input');
  const taskTypeSelect = document.getElementById('task-type-select');
  const addTaskBtn = document.getElementById('add-task-btn');

  if (!chrome || !chrome.storage) {
    if (tasksList) {
      tasksList.innerHTML = '<p>Error: Chrome storage API not available</p>';
    }
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const PERMANENT_TASKS = ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];

  async function loadData() {
    try {
      const result = await chrome.storage.local.get(['permanentTasks', 'tasks', 'progress', 'taskUrls', 'websiteActivity', 'taskTypes']);
      const permanentTasks = result.permanentTasks || ['LeetCode', 'GRE Practice', 'ML Practice', 'Maths'];
      const customTasks = result.tasks || [];
      const allTasks = [...permanentTasks, ...customTasks];
      const progress = result.progress || {};
      const taskUrls = result.taskUrls || {};
      const websiteActivity = result.websiteActivity || {};
      const taskTypes = result.taskTypes || {};
      const todayProgress = progress[today] || {};
      const todayActivity = websiteActivity[today] || {};

      if (tasksList) {
        tasksList.innerHTML = '';

        allTasks.forEach(task => {
          const taskType = taskTypes[task] || 'daily';
          const taskItem = document.createElement('div');
          taskItem.className = 'task-item';
          
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = `task-${task}`;
          checkbox.checked = todayProgress[task] || false;
          
          const label = document.createElement('label');
          label.htmlFor = `task-${task}`;
          
          const taskName = document.createElement('span');
          taskName.textContent = task;
          
          // Show task type badge for custom tasks
          if (taskType === 'onetime') {
            const badge = document.createElement('span');
            badge.style.cssText = 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px; font-weight: 500;';
            badge.textContent = 'One-Time';
            taskName.appendChild(badge);
          }
          
          label.appendChild(taskName);
          
          const taskUrl = taskUrls[task] || '';
          const hasActivity = todayActivity[task] || false;
          
          // If task has a URL but no activity, disable checkbox
          if (taskUrl && taskUrl.trim() !== '' && !hasActivity) {
            checkbox.disabled = true;
            taskItem.classList.add('disabled');
            const status = document.createElement('span');
            status.className = 'activity-status';
            status.textContent = ' (No activity)';
            status.style.color = '#f44336';
            status.style.fontSize = '11px';
            label.appendChild(status);
          } else if (taskUrl && taskUrl.trim() !== '' && hasActivity) {
            const status = document.createElement('span');
            status.className = 'activity-status';
            status.textContent = ' ✓';
            status.style.color = '#4CAF50';
            status.style.fontSize = '11px';
            label.appendChild(status);
          }

          if (checkbox.checked) {
            taskItem.classList.add('completed');
          }

          checkbox.addEventListener('change', async () => {
            try {
              // Check if task has URL but no activity
              if (taskUrl && taskUrl.trim() !== '' && !hasActivity) {
                checkbox.checked = false;
                return;
              }
              
              const result = await chrome.storage.local.get(['progress']);
              const progress = result.progress || {};
              if (!progress[today]) {
                progress[today] = {};
              }
              progress[today][task] = checkbox.checked;
              
              if (checkbox.checked) {
                taskItem.classList.add('completed');
              } else {
                taskItem.classList.remove('completed');
              }

              await chrome.storage.local.set({ progress });
              loadData(); // Reload to update UI
            } catch (error) {
              console.error('Error saving progress:', error);
            }
          });

          taskItem.appendChild(checkbox);
          taskItem.appendChild(label);
          tasksList.appendChild(taskItem);
        });
      }
    } catch (error) {
      if (tasksList) {
        tasksList.innerHTML = `<p>Error loading tasks: ${error.message}</p>`;
      }
      console.error('Error loading data:', error);
    }
  }

  if (viewHeatmapBtn) {
    viewHeatmapBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('heatmap.html') });
    });
  }

  const viewArchiveBtn = document.getElementById('view-archive');

  if (optionsBtn) {
    optionsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (viewArchiveBtn) {
    viewArchiveBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('archive.html') });
    });
  }

  // Toggle add task form
  if (toggleAddTaskBtn && addTaskForm) {
    toggleAddTaskBtn.addEventListener('click', () => {
      addTaskForm.classList.toggle('hidden');
      if (!addTaskForm.classList.contains('hidden') && newTaskInput) {
        newTaskInput.focus();
      }
    });
  }

  // Add task functionality
  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', async () => {
      const taskName = newTaskInput ? newTaskInput.value.trim() : '';
      const taskType = taskTypeSelect ? taskTypeSelect.value : 'daily';
      
      if (taskName) {
        try {
          const result = await chrome.storage.local.get(['tasks', 'taskUrls', 'taskTypes', 'permanentTasks']);
          const tasks = result.tasks || [];
          const taskUrls = result.taskUrls || {};
          const taskTypes = result.taskTypes || {};
          const permanentTasks = result.permanentTasks || PERMANENT_TASKS;
          
          // Check if task already exists (in permanent or custom)
          const allTasks = [...permanentTasks, ...tasks];
          if (allTasks.includes(taskName)) {
            alert('Task already exists!');
            return;
          }
          
          // Add new task
          tasks.push(taskName);
          taskUrls[taskName] = ''; // Initialize with empty URL
          taskTypes[taskName] = taskType;
          
          await chrome.storage.local.set({ tasks, taskUrls, taskTypes });
          
          // Clear input and hide form
          if (newTaskInput) {
            newTaskInput.value = '';
          }
          if (addTaskForm) {
            addTaskForm.classList.add('hidden');
          }
          
          // Reload data to show new task
          loadData();
        } catch (error) {
          console.error('Error adding task:', error);
          alert('Error adding task. Please try again.');
        }
      }
    });
  }

  // Allow Enter key to add task
  if (newTaskInput) {
    newTaskInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && addTaskBtn) {
        addTaskBtn.click();
      }
    });
  }

  loadData();
});

